import * as Sentry from "@sentry/nextjs";

/** Tag the current request's error events with the org (an id, not personal data). No-op without Sentry. */
export function setOrgContext(orgId: string) {
  Sentry.getIsolationScope().setTag("org_id", orgId);
}
