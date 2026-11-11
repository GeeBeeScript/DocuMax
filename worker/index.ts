import "./load-env";
import { Worker, type Job } from "bullmq";
import { QUEUES, parseJob, redisConnection } from "@/lib/queue";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logger } from "./logger";
import { markDocumentFailed, processDocument } from "./processors/process-document";

/**
 * DocuMax background worker. Runs outside Next.js (long OCR / AI / PDF jobs).
 * One BullMQ Worker per queue; processors live in worker/processors/*.
 */

const db = createSupabaseAdminClient();
const STUB_STEP_MS = Number(process.env.STUB_STEP_MS ?? 800);

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
      stepMs: STUB_STEP_MS,
      log: (message, meta) => logger.info(message, { jobId: job.id, ...meta }),
    });
  },
  { connection: redisConnection(), concurrency: 4 },
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

const workers = [health, documents];

for (const w of workers) {
  w.on("failed", (job, err) =>
    logger.error("job failed", { queue: w.name, jobId: job?.id, error: err.message }),
  );
  w.on("error", (err) => logger.error("worker error", { queue: w.name, error: err.message }));
}

logger.info("worker started", { queues: workers.map((w) => w.name) });

async function shutdown(signal: string) {
  logger.info("shutting down", { signal });
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
