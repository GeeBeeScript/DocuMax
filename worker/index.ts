import "./load-env";
import { Worker, type Job } from "bullmq";
import { QUEUES, enqueue, parseJob, redisConnection } from "@/lib/queue";
import { extractionModel, extractionModelInfo, extractionProviderOptions } from "@/lib/ai/provider";
import { createTesseractEngine } from "@/lib/pipeline/ocr";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "./logger";
import { closeBrowser, renderPdf } from "./pdf/render";
import { batchZipJob } from "./processors/batch-zip";
import { importCsvJob } from "./processors/import-csv";
import { markDocumentFailed, processDocument } from "./processors/process-document";
import { markReportFailed, renderReportJob } from "./processors/render-report";

/**
 * DocuMax background worker. Runs outside Next.js (long OCR / AI / PDF jobs).
 * One BullMQ Worker per queue; processors live in worker/processors/*.
 */

const db = createSupabaseAdminClient();
const STUB_STEP_MS = Number(process.env.STUB_STEP_MS ?? 800);
const OCR_WORKERS = Number(process.env.OCR_WORKERS ?? 2);

// One Tesseract pool per process, reused by every job (language data ships in node_modules). Started now,
// awaited by the first job (no top-level await: tsx runs this file as CommonJS).
const ocrReady = createTesseractEngine({ workers: OCR_WORKERS });

// AI provider/model from env (ADR-003). Built at start-up so a missing key fails loudly here, not per job.
const ai = {
  model: extractionModel(),
  providerOptions: extractionProviderOptions(),
  info: extractionModelInfo(),
};

const health = new Worker(
  QUEUES.health,
  async (job: Job) => {
    const payload = parseJob(QUEUES.health, job.data);
    const latencyMs = Date.now() - new Date(payload.sentAt).getTime();
    logger.info("health job processed", { jobId: job.id, latencyMs });
    return { ok: true, latencyMs };
  },
  { connection: redisConnection(), concurrency: 1 },
);

const documents = new Worker(
  QUEUES.processDocument,
  async (job: Job) => {
    const payload = parseJob(QUEUES.processDocument, job.data);
    return processDocument(payload, {
      db,
      ocr: await ocrReady,
      ai,
      stepMs: STUB_STEP_MS,
      log: (message, meta) => logger.info(message, { jobId: job.id, ...meta }),
    });
  },
  // OCR is CPU-bound; more concurrent jobs than OCR workers only queues inside Tesseract.
  { connection: redisConnection(), concurrency: OCR_WORKERS },
);

documents.on("failed", (job, err) => {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return; // BullMQ will retry
  const parsed = (() => {
    try {
      return parseJob(QUEUES.processDocument, job.data);
    } catch {
      return null;
    }
  })();
  if (!parsed) return;
  markDocumentFailed(
    db,
    parsed,
    "Processing failed. Try again, or contact support if it keeps happening.",
  ).catch((e: Error) =>
    logger.error("could not mark document failed", {
      jobId: job.id,
      documentId: parsed.documentId,
      error: e.message,
    }),
  );
  logger.error("document processing failed", {
    jobId: job.id,
    orgId: parsed.orgId,
    documentId: parsed.documentId,
    error: err.message,
  });
});

const enqueueZip = async (payload: { orgId: string; batchId: string }) => {
  await enqueue(QUEUES.batchZip, payload, `zip-${payload.batchId}`);
};
const REPORT_WORKERS = Number(process.env.REPORT_WORKERS ?? 2);

const reports = new Worker(
  QUEUES.renderReport,
  async (job: Job) =>
    renderReportJob(parseJob(QUEUES.renderReport, job.data), {
      db,
      render: renderPdf,
      enqueueZip,
      log: (message, meta) => logger.info(message, { jobId: job.id, ...meta }),
    }),
  // One shared Chromium; each job gets its own context.
  { connection: redisConnection(), concurrency: REPORT_WORKERS },
);

reports.on("failed", (job) => {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  try {
    const payload = parseJob(QUEUES.renderReport, job.data);
    markReportFailed(db, payload, "The PDF couldn't be generated. Try again.", { enqueueZip }).catch(
      (e: Error) => logger.error("could not mark report failed", { jobId: job.id, error: e.message }),
    );
  } catch {
    // invalid payload: nothing to mark
  }
});

const zips = new Worker(
  QUEUES.batchZip,
  async (job: Job) =>
    batchZipJob(parseJob(QUEUES.batchZip, job.data), {
      db,
      log: (message, meta) => logger.info(message, { jobId: job.id, ...meta }),
    }),
  { connection: redisConnection(), concurrency: 1 },
);

zips.on("failed", (job) => {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  try {
    const { orgId, batchId } = parseJob(QUEUES.batchZip, job.data);
    void db
      .from("report_batches")
      .update({ status: "failed", error: "The ZIP file couldn't be created. Try again." })
      .eq("org_id", orgId)
      .eq("id", batchId)
      .then(
        ({ error }) =>
          error && logger.error("could not mark batch failed", { batchId, error: error.message }),
      );
  } catch {
    // invalid payload: nothing to mark
  }
});

const imports = new Worker(
  QUEUES.importCsv,
  async (job: Job) =>
    importCsvJob(parseJob(QUEUES.importCsv, job.data), {
      db,
      log: (message, meta) => logger.info(message, { jobId: job.id, ...meta }),
    }),
  { connection: redisConnection(), concurrency: 1 },
);

imports.on("failed", (job) => {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  try {
    const { orgId, importId } = parseJob(QUEUES.importCsv, job.data);
    void db
      .from("imports")
      .update({ status: "failed", error: "The import couldn't be completed. Try again." })
      .eq("org_id", orgId)
      .eq("id", importId)
      .neq("status", "done")
      .then(
        ({ error }) =>
          error && logger.error("could not mark import failed", { importId, error: error.message }),
      );
  } catch {
    // invalid payload: nothing to mark
  }
});

const workers = [health, documents, reports, zips, imports];

for (const w of workers) {
  w.on("failed", (job, err) =>
    logger.error("job failed", { queue: w.name, jobId: job?.id, error: err.message }),
  );
  w.on("error", (err) => logger.error("worker error", { queue: w.name, error: err.message }));
}

logger.info("worker started", { queues: workers.map((w) => w.name), ocrWorkers: OCR_WORKERS, ai: ai.info });

async function shutdown(signal: string) {
  logger.info("shutting down", { signal });
  await Promise.all(workers.map((w) => w.close()));
  await (await ocrReady).terminate();
  await closeBrowser();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
