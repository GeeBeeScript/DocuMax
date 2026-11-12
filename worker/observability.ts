import * as Sentry from "@sentry/node";
import { scrubEvent } from "@/lib/observability/scrub";

/**
 * Worker error reporting (Sentry when SENTRY_DSN is set). Each failed job is reported with queue, job id, org id
 * and attempt — never document text or personal data (scrubEvent).
 */
export function initObservability(options: Partial<Sentry.NodeOptions> = {}) {
  const dsn = options.dsn ?? process.env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
    ...options,
  });
  return true;
}

export interface JobContext {
  queue: string;
  jobId?: string;
  orgId?: string;
  attempt?: number;
  final?: boolean;
}

export function reportJobFailure(error: Error, ctx: JobContext) {
  Sentry.withScope((scope) => {
    scope.setTags({
      queue: ctx.queue,
      ...(ctx.jobId ? { job_id: ctx.jobId } : {}),
      ...(ctx.orgId ? { org_id: ctx.orgId } : {}),
      final_attempt: String(ctx.final ?? false),
    });
    if (ctx.attempt != null) scope.setContext("job", { attempt: ctx.attempt });
    Sentry.captureException(error);
  });
}

export const flushObservability = (ms = 2000) => Sentry.flush(ms);
