import "./load-env";
import { Worker, type Job } from "bullmq";
import { QUEUES, parseJob, redisConnection } from "@/lib/queue";
import { logger } from "./logger";

/**
 * DocuMax background worker. Runs outside Next.js (long OCR / AI / PDF jobs).
 * One BullMQ Worker per queue; processors live in worker/processors/* as phases land.
 */

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

const workers = [health];

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
