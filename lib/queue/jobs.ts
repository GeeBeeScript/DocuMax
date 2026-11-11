import { z } from "zod";

/**
 * Queue names + typed, zod-validated job payloads. Shared by the web app
 * (producers) and the worker (consumers). Every tenant job carries `orgId` —
 * the worker must scope every DB/storage call by it (docs/MULTI_TENANCY.md).
 */

export const QUEUES = {
  health: "health",
  processDocument: "process-document",
  renderReport: "render-report",
  batchZip: "batch-zip",
  importCsv: "import-csv",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

const tenantJob = z.object({ orgId: z.uuid() });

export const jobSchemas = {
  [QUEUES.health]: z.object({ sentAt: z.iso.datetime() }),
  [QUEUES.processDocument]: tenantJob.extend({ documentId: z.uuid() }),
  [QUEUES.renderReport]: tenantJob.extend({ reportId: z.uuid() }),
  [QUEUES.batchZip]: tenantJob.extend({ batchId: z.uuid() }),
  [QUEUES.importCsv]: tenantJob.extend({ importId: z.uuid() }),
} satisfies Record<QueueName, z.ZodType>;

export type JobPayload<Q extends QueueName> = z.infer<(typeof jobSchemas)[Q]>;

export function parseJob<Q extends QueueName>(queue: Q, data: unknown): JobPayload<Q> {
  return jobSchemas[queue].parse(data) as JobPayload<Q>;
}
