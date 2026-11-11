import type { SupabaseClient } from "@supabase/supabase-js";
import { forOrg } from "@/lib/db/org-scope";
import type { DocumentStatus } from "@/lib/documents/status";
import type { JobPayload } from "@/lib/queue";
import type { Database } from "@/lib/supabase/database.types";

/**
 * `process-document` — Phase 3 STUB. Walks the status machine with short pauses so the UI can be built
 * against real, live status changes. Phases 4–6 replace the middle stages with text extraction, AI
 * extraction and validation (docs/DOCUMENT_PIPELINE.md); the guard rails here stay:
 *   - the row must belong to the job's org (forOrg.requireRow),
 *   - the file must exist in Storage,
 *   - every transition is status-checked (transition_document), so retries are idempotent.
 */

export const WORKER_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

/** queued → extracting → analyzing → validating → ready */
export const STUB_STEPS: readonly (readonly [DocumentStatus, DocumentStatus])[] = [
  ["queued", "extracting"],
  ["extracting", "analyzing"],
  ["analyzing", "validating"],
  ["validating", "ready"],
];

const FINAL: DocumentStatus[] = ["ready", "needs_review", "failed"];

export interface ProcessDeps {
  db: SupabaseClient<Database>;
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

export async function processDocument(
  { orgId, documentId }: JobPayload<"process-document">,
  { db, stepMs, sleep = defaultSleep, log = () => undefined }: ProcessDeps,
): Promise<ProcessResult> {
  const doc = await forOrg(db, orgId).requireRow("documents", documentId);
  if (FINAL.includes(doc.status) || doc.status === "uploading") {
    log("document not processable; skipping", { orgId, documentId, status: doc.status });
    return { outcome: "skipped", status: doc.status };
  }

  const file = await db.storage.from("documents").info(doc.storage_path);
  if (file.error || !file.data) {
    await transition(db, orgId, documentId, [doc.status], "failed", "The uploaded file could not be found.");
    return { outcome: "failed", status: "failed" };
  }

  let status: DocumentStatus = doc.status;
  for (const [from, to] of STUB_STEPS) {
    if (from !== status) continue;
    await sleep(stepMs);
    const moved = await transition(db, orgId, documentId, [from], to);
    if (!moved) {
      // Someone else moved it (another attempt, a retry). Stop rather than fight over it.
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
