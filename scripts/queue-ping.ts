import "../worker/load-env";
import { QueueEvents } from "bullmq";
import { QUEUES, closeQueues, enqueue, redisConnection } from "@/lib/queue";

/** Enqueue a health job and wait for the worker to complete it. `npm run queue:ping` */
async function main() {
  const events = new QueueEvents(QUEUES.health, { connection: redisConnection() });
  await events.waitUntilReady();

  const job = await enqueue(QUEUES.health, { sentAt: new Date().toISOString() });
  console.log(`enqueued health job ${job.id}, waiting for worker…`);

  const result = await job.waitUntilFinished(events, 15_000);
  console.log("worker result:", result);

  await events.close();
  await closeQueues();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
