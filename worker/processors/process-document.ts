import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { forOrg } from "@/lib/db/org-scope";
import type { DocumentStatus } from "@/lib/documents/status";
import { extractDocumentText } from "@/lib/pipeline/extract-document";
import { isPipelineError } from "@/lib/pipeline/errors";
import type { OcrEngine } from "@/lib/pipeline/ocr";
import type { JobPayload } from "@/lib/queue";
import type { Database } from "@/lib/supabase/database.types";

/**
 * `process-document` (docs/DOCUMENT_PIPELINE.md).
 *   Stage 1 — text extraction (Phase 4): queued → extracting → [text layer / OCR → document_pages] → analyzing
 *   Stages 2–3 — STUB until Phases 5–6: analyzing → validating → ready, with short pauses.
 * Guard rails: the row must belong to the job's org (forOrg.requireRow); every transition is status-checked in
 * the database, so duplicate/late jobs stop instead of moving a document backwards; permanent document problems
 * (PipelineError) fail the document immediately with a readable message, anything else is retried by BullMQ.
 */

export const WORKER_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

/** Placeholder for AI extraction (Phase 5) and validation (Phase 6). */
export const STUB_STEPS: readonly (readonly [DocumentStatus, DocumentStatus])[] = [
  ["analyzing", "validating"],
  ["validating", "ready"],
];

const FINAL: DocumentStatus[] = ["ready", "needs_review", "failed"];

export interface ProcessDeps {
  db: SupabaseClient<Database>;
  ocr: OcrEngine;
  stepMs: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string, meta: Record<string, unknown>) => void;
}

export type ProcessResult = { outcome: "done" | "skipped" | "failed"; status: DocumentStatus };

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function transition(
  db: SupabaseClient<Database>,
  orgId: string,
  documentId: string,
  from: DocumentStatus[],
  to: DocumentStatus,
  error?: string,
) {
  const { data, error: rpcError } = await db.rpc("transition_document", {
    p_org: orgId,
    p_document: documentId,
    p_from: from,
    p_to: to,
    p_error: error,
    p_actor: WORKER_ACTOR_ID,
  });
  if (rpcError) throw rpcError;
  return data?.id ? data : null;
}

/** Stage 1. Returns the next status, or a terminal result. */
async function extractStage(
  payload: JobPayload<"process-document">,
  doc: { storage_path: string; mime_type: string },
  { db, ocr, log = () => undefined }: ProcessDeps,
): Promise<ProcessResult | "analyzing"> {
  const { orgId, documentId } = payload;
  const fail = async (message: string): Promise<ProcessResult> => {
    await transition(db, orgId, documentId, ["extracting"], "failed", message);
    return { outcome: "failed", status: "failed" };
  };

  const download = await db.storage.from("documents").download(doc.storage_path);
  if (download.error || !download.data) return fail("The uploaded file could not be found.");
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const started = Date.now();
  let result;
  try {
    result = await extractDocumentText(bytes, doc.mime_type, { ocr });
  } catch (error) {
    if (isPipelineError(error)) {
      log("document cannot be read", { orgId, documentId, code: error.code });
      return fail(error.message);
    }
    throw error; // transient → BullMQ retry
  }
  log("text extracted", {
    orgId,
    documentId,
    pageCount: result.pageCount,
    ocrPages: result.ocrPages,
    ms: Date.now() - started,
  });

  const { data, error } = await db.rpc("save_document_pages", {
    p_org: orgId,
    p_document: documentId,
    p_page_count: result.pageCount,
    p_sha256: sha256,
    p_actor: WORKER_ACTOR_ID,
    p_pages: result.pages.map((p) => ({
      page_no: p.pageNo,
      text: p.text,
      source: p.source,
      ocr_confidence: p.ocrConfidence,
    })),
  });
  if (error) throw error;
  if (!data?.id) return { outcome: "skipped", status: "extracting" }; // moved on concurrently
  return "analyzing";
}

export async function processDocument(
  payload: JobPayload<"process-document">,
  deps: ProcessDeps,
): Promise<ProcessResult> {
  const { orgId, documentId } = payload;
  const { db, stepMs, sleep = defaultSleep, log = () => undefined } = deps;

  const doc = await forOrg(db, orgId).requireRow("documents", documentId);
  if (FINAL.includes(doc.status) || doc.status === "uploading") {
    log("document not processable; skipping", { orgId, documentId, status: doc.status });
    return { outcome: "skipped", status: doc.status };
  }

  let status: DocumentStatus = doc.status;
  if (status === "queued") {
    if (!(await transition(db, orgId, documentId, ["queued"], "extracting"))) {
      return { outcome: "skipped", status };
    }
    status = "extracting";
  }

  // A retry after a crash mid-extraction resumes here too (status is still `extracting`).
  if (status === "extracting") {
    const next = await extractStage(payload, doc, deps);
    if (next !== "analyzing") return next;
    status = next;
  }

  for (const [from, to] of STUB_STEPS) {
    if (from !== status) continue;
    await sleep(stepMs);
    if (!(await transition(db, orgId, documentId, [from], to))) {
      log("document moved concurrently; stopping", { orgId, documentId, expected: from });
      return { outcome: "skipped", status };
    }
    status = to;
    log("document status", { orgId, documentId, status });
  }
  return { outcome: "done", status };
}

/** After the last BullMQ attempt fails: record the failure on the document (if it's still in flight). */
export async function markDocumentFailed(
  db: SupabaseClient<Database>,
  { orgId, documentId }: JobPayload<"process-document">,
  message: string,
) {
  await transition(
    db,
    orgId,
    documentId,
    ["queued", "extracting", "analyzing", "validating"],
    "failed",
    message,
  );
}
