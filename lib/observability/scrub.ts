/**
 * Strips personal data from an error event before it leaves the process (Sentry `beforeSend`). Keeps what helps
 * debugging without identifying anyone: org id, job id, queue, route. Removes: user email/IP/name, cookies,
 * headers, request bodies and query strings, breadcrumbs (may carry URLs and console output), and any email
 * address that slipped into a message. Pure — unit-tested.
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const redact = (s: string | undefined) => s?.replace(EMAIL, "[email]");

interface ScrubbableEvent {
  message?: string;
  user?: { id?: string | number; [k: string]: unknown };
  request?: { url?: string; method?: string; [k: string]: unknown };
  breadcrumbs?: unknown[];
  exception?: { values?: { value?: string; [k: string]: unknown }[] };
  extra?: Record<string, unknown>;
  [k: string]: unknown;
}

export function scrubEvent<E extends object>(event: E): E {
  const out = { ...event } as ScrubbableEvent;
  if (out.user) out.user = out.user.id != null ? { id: out.user.id } : undefined;
  if (out.request) out.request = { method: out.request.method, url: out.request.url?.split("?")[0] };
  delete out.breadcrumbs;
  delete out.extra;
  if (out.message) out.message = redact(out.message);
  if (out.exception?.values) {
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((v) => ({ ...v, value: redact(v.value) })),
    };
  }
  return out as unknown as E;
}
