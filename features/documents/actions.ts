"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { fail, failCode, invalid, ok, type ActionResult } from "@/lib/actions/result";
import { canWrite, ForbiddenError } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { billingCopy } from "@/content/app";
import { storageFileName } from "@/lib/documents/upload-rules";
import { enqueue, QUEUES } from "@/lib/queue";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DocumentIdSchema, RequestUploadSchema } from "./schema";

/*
 * Upload flow (docs/ARCHITECTURE.md): requestUpload → browser PUTs the file to the signed URL → confirmUpload
 * (status queued + enqueue process-document). Everything runs as the user (RLS + storage policies); the
 * service-role client is never used here.
 */

const BUCKET = "documents";
const FORBIDDEN = new ForbiddenError().message;

export interface UploadTicket {
  documentId: string;
  uploadUrl: string;
  /** An earlier document in this org with the same file contents (early duplicate warning). */
  duplicateOf: { id: string; fileName: string } | null;
}

export async function requestUpload(input: unknown): Promise<ActionResult<UploadTicket>> {
  const parsed = RequestUploadSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, parsed.error.issues[0]?.message);
  const ctx = await requireActiveOrg();
  if (!canWrite(ctx.role)) return fail(FORBIDDEN);

  const supabase = await createSupabaseServerClient();
  const { fileName, mimeType, sizeBytes, sha256, entityId } = parsed.data;

  let duplicateOf: UploadTicket["duplicateOf"] = null;
  if (sha256) {
    const { data } = await supabase
      .from("documents")
      .select("id, file_name")
      .eq("org_id", ctx.org.id)
      .eq("sha256", sha256)
      .neq("status", "uploading")
      .order("created_at")
      .limit(1);
    if (data?.[0]) duplicateOf = { id: data[0].id, fileName: data[0].file_name };
  }

  const documentId = randomUUID();
  const storagePath = `${ctx.org.id}/documents/${documentId}/${storageFileName(fileName)}`;

  // Sign first: if the user may not write to this path, no row is created.
  const signed = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
  if (signed.error) return fail("Couldn't prepare the upload. Please try again.");

  // Counts against the monthly cap and creates the pending row in one transaction (docs/DATA_MODEL.md → Billing).
  const { error } = await supabase.rpc("create_document_upload", {
    p_org: ctx.org.id,
    p_id: documentId,
    p_storage_path: storagePath,
    p_file_name: fileName,
    p_mime_type: mimeType,
    p_size_bytes: sizeBytes,
    p_sha256: sha256 ?? (null as unknown as string),
    p_entity: entityId ?? (null as unknown as string),
  });
  if (error) {
    if (error.message === "quota_exceeded") return failCode("quota_exceeded", billingCopy.quotaExceeded);
    return fail(error.code === "42501" ? FORBIDDEN : "Couldn't prepare the upload. Please try again.");
  }
  return ok({ documentId, uploadUrl: signed.data.signedUrl, duplicateOf });
}

/** The browser couldn't finish uploading: drop the pending document and give its quota back. */
export async function cancelUpload(input: unknown): Promise<ActionResult> {
  const parsed = DocumentIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await requireActiveOrg();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_document_upload", { p_document: parsed.data.documentId });
  if (error) return fail("Something went wrong. Please try again.");
  return ok();
}

async function startProcessing(orgId: string, documentId: string, attempts: number) {
  // One job id per attempt: re-sending the same attempt is a no-op in BullMQ, a retry gets a fresh job.
  await enqueue(QUEUES.processDocument, { orgId, documentId }, `${documentId}-${attempts}`);
}

/** Called after the browser finished the PUT. Verifies the stored object, then queues processing. */
export async function confirmUpload(input: unknown): Promise<ActionResult<{ status: string }>> {
  const parsed = DocumentIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await requireActiveOrg();
  if (!canWrite(ctx.role)) return fail(FORBIDDEN);

  const supabase = await createSupabaseServerClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, org_id, storage_path, size_bytes, status")
    .eq("id", parsed.data.documentId)
    .eq("org_id", ctx.org.id)
    .maybeSingle();
  if (!doc) return fail("Document not found.");

  if (doc.status === "uploading") {
    const info = await supabase.storage.from(BUCKET).info(doc.storage_path);
    if (info.error || !info.data) return fail("The file didn't finish uploading. Please try again.");
    if (info.data.size !== doc.size_bytes) return fail("The uploaded file is incomplete. Please try again.");
  }

  const { data: confirmed, error } = await supabase.rpc("confirm_document_upload", { p_document: doc.id });
  if (error || !confirmed) return fail("Document not found.");
  if (confirmed.status === "queued") {
    try {
      await startProcessing(ctx.org.id, doc.id, confirmed.attempts);
    } catch {
      return fail("Uploaded, but processing couldn't start. Use Retry on the document.");
    }
  }
  revalidatePath("/app/documents");
  return ok({ status: confirmed.status });
}

/**
 * Retry processing: failed → queued (new attempt), or re-send the job for a document stuck in queued
 * (e.g. the queue was unavailable at confirm time). Idempotent per attempt.
 */
export async function retryDocument(input: unknown): Promise<ActionResult> {
  const parsed = DocumentIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await requireActiveOrg();
  if (!canWrite(ctx.role)) return fail(FORBIDDEN);

  const supabase = await createSupabaseServerClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, status, attempts")
    .eq("id", parsed.data.documentId)
    .eq("org_id", ctx.org.id)
    .maybeSingle();
  if (!doc) return fail("Document not found.");

  let attempts = doc.attempts;
  if (doc.status === "failed") {
    const { data, error } = await supabase.rpc("retry_document", { p_document: doc.id });
    if (error || !data) return fail("Couldn't retry this document.");
    attempts = data.attempts;
  } else if (doc.status !== "queued") {
    return fail("Only failed documents can be retried.");
  }

  try {
    await startProcessing(ctx.org.id, doc.id, attempts);
  } catch {
    return fail("Processing couldn't start. Please try again shortly.");
  }
  revalidatePath("/app/documents");
  revalidatePath(`/app/documents/${doc.id}`);
  return ok();
}
