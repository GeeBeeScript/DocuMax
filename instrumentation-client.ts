import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/observability/scrub";

// Browser error reporting when NEXT_PUBLIC_SENTRY_DSN is set; same PII scrubbing as the server.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0, beforeSend: (event) => scrubEvent(event) });
}
