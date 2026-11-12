import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { forOrg } from "@/lib/db/org-scope";
import type { DocumentStatus } from "@/lib/documents/status";
import { ExtractionError, extractInvoice, type ExtractOptions } from "@/lib/ai/extract";
import type { PageInput } from "@/lib/ai/prompt";
import { extractDocumentText } from "@/lib/pipeline/extract-document";
import { mapExtraction, type PageConfidence } from "@/lib/pipeline/map-extraction";
import { isPipelineError } from "@/lib/pipeline/errors";
import type { OcrEngine } from "@/lib/pipeline/ocr";
import type { JobPayload } from "@/lib/queue";
import type { Database } from "@/lib/supabase/database.types";

/**
 * `process-document` (docs/DOCUMENT_PIPELINE.md).
 *   Stage 1 — text extraction (Phase 4): queued → extracting → [text layer / OCR → document_pages] → analyzing
 *   Stage 2 — AI extraction (Phase 5): analyzing → [model → validated schema → records/line_items] → validating
 *   Stage 3 — STUB until Phase 6: validating → ready, with a short pause.
 * Guard rails: the row must belong to the job's org (forOrg.requireRow); every transition is status-checked in
 * the database, so duplicate/late jobs stop instead of moving a document backwards; permanent document problems
 * (PipelineError) fail the document immediately with a readable message, anything else is retried by BullMQ.
 */

export const WORKER_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

/** Placeholder for validation + routing (Phase 6). */
export const STUB_STEPS: readonly (readonly [DocumentStatus, DocumentStatus])[] = [["validating", "ready"]];

/** Cap on org context sent with each extraction (entities / known suppliers). */
const CONTEXT_LIMIT = 300;

const FINAL: DocumentStatus[] = ["ready", "needs_review", "failed"];

export interface AiDeps extends Pick<ExtractOptions, "model" | "providerOptions"> {
  /** Stored with each extraction for cost/accuracy comparisons. */
  info: { provider: string; model: string };
}

export interface ProcessDeps {
  db: SupabaseClient<Database>;
  ocr: OcrEngine;
  ai: AiDeps;
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

/** Stage 2. Returns "validating" on success, or a terminal result. */
async function aiStage(
  payload: JobPayload<"process-document">,
  assignedEntityId: string | null,
  { db, ai, log = () => undefined }: ProcessDeps,
): Promise<ProcessResult | "validating"> {
  const { orgId, documentId } = payload;
  const scope = forOrg(db, orgId);

  const [pagesRes, entitiesRes, suppliersRes, orgRes] = await Promise.all([
    scope
      .select("document_pages", "page_no, text, source, ocr_confidence")
      .eq("document_id", documentId)
      .order("page_no"),
    scope
      .select("entities", "id, name, code, address")
      .eq("status", "active")
      .order("name")
      .limit(CONTEXT_LIMIT),
    scope
      .select("records", "supplier_name")
      .not("supplier_name", "is", null)
      .order("created_at", { ascending: false })
      .limit(CONTEXT_LIMIT),
    db.from("organizations").select("entity_kind").eq("id", orgId).single(),
  ]);
  for (const r of [pagesRes, entitiesRes, suppliersRes, orgRes]) if (r.error) throw r.error;

  const pageRows = pagesRes.data as unknown as {
    page_no: number;
    text: string;
    source: "text_layer" | "ocr";
    ocr_confidence: number | null;
  }[];
  const entities = entitiesRes.data as unknown as {
    id: string;
    name: string;
    code: string | null;
    address: string | null;
  }[];
  const suppliers = [
    ...new Set((suppliersRes.data as unknown as { supplier_name: string }[]).map((r) => r.supplier_name)),
  ];
  const pages: PageInput[] = pageRows.map((p) => ({ pageNo: p.page_no, text: p.text }));
  const confidences: PageConfidence[] = pageRows.map((p) => ({
    source: p.source,
    ocrConfidence: p.ocr_confidence === null ? null : Number(p.ocr_confidence),
  }));

  let run;
  try {
    run = await extractInvoice(
      pages,
      { entityKind: orgRes.data!.entity_kind, entities, knownSuppliers: suppliers },
      { model: ai.model, providerOptions: ai.providerOptions },
    );
  } catch (error) {
    if (error instanceof ExtractionError) {
      log("extraction failed permanently", { orgId, documentId, code: error.code, details: error.details });
      await transition(db, orgId, documentId, ["analyzing"], "failed", error.message);
      return { outcome: "failed", status: "failed" };
    }
    throw error; // transient (network, rate limit, 5xx) → BullMQ retry
  }

  const mapped = mapExtraction(run.extraction, { pages: confidences, entities, assignedEntityId });
  // Cost/latency per extraction (no document text or PII in logs).
  log("ai extraction", {
    orgId,
    documentId,
    provider: ai.info.provider,
    model: ai.info.model,
    attempts: run.attempts,
    latencyMs: run.latencyMs,
    tokensIn: run.usage.inputTokens,
    tokensOut: run.usage.outputTokens,
    minConfidence: mapped.record.min_confidence,
    entityMatchedBy: mapped.entityMatch?.by ?? null,
  });

  const { data, error } = await db.rpc("save_extraction", {
    p_org: orgId,
    p_document: documentId,
    p_actor: WORKER_ACTOR_ID,
    p_extraction: {
      provider: ai.info.provider,
      model: ai.info.model,
      schema_version: run.schemaVersion,
      raw: run.raw as never,
      fields: run.extraction as never,
      attempts: run.attempts,
      latency_ms: run.latencyMs,
      tokens_in: run.usage.inputTokens,
      tokens_out: run.usage.outputTokens,
    },
    p_record: mapped.record as never,
    p_lines: mapped.lineItems as never,
  });
  if (error) throw error;
  if (!data?.id) return { outcome: "skipped", status: "analyzing" }; // moved on concurrently
  return "validating";
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

  // A retry after a crash mid-stage resumes at the stage the document is in.
  if (status === "extracting") {
    const next = await extractStage(payload, doc, deps);
    if (next !== "analyzing") return next;
    status = next;
  }

  if (status === "analyzing") {
    const next = await aiStage(payload, doc.entity_id, deps);
    if (next !== "validating") return next;
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
