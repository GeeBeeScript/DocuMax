import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/observability/scrub";

/**
 * Next.js instrumentation: error reporting to Sentry when SENTRY_DSN is set (otherwise nothing is initialised).
 * No PII (scrubEvent), no performance tracing; org id is attached per request by requireActiveOrg().
 */
export function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
  });
}

export const onRequestError: typeof Sentry.captureRequestError = (...args) => {
  if (process.env.SENTRY_DSN) Sentry.captureRequestError(...args);
};
