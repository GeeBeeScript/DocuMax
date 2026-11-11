import { Queue, type ConnectionOptions } from "bullmq";
import { serverEnv } from "@/lib/env";
import { jobSchemas, type JobPayload, type QueueName } from "./jobs";

/** BullMQ connection from REDIS_URL. `maxRetriesPerRequest: null` is required by BullMQ workers. */
export function redisConnection(): ConnectionOptions {
  return { url: serverEnv().REDIS_URL, maxRetriesPerRequest: null };
}

const queues = new Map<QueueName, Queue>();

/** Lazily created, process-wide Queue instances (producers). */
export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection: redisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    });
    queues.set(name, queue);
  }
  return queue;
}

/** Validate the payload, then enqueue. Use this instead of `queue.add` directly. */
export async function enqueue<Q extends QueueName>(name: Q, payload: JobPayload<Q>, jobId?: string) {
  const data = jobSchemas[name].parse(payload);
  return getQueue(name).add(name, data, jobId ? { jobId } : undefined);
}

export async function closeQueues() {
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
}
