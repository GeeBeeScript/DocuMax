/** Structured logger (JSON lines on stdout/stderr — the platform collects them). Errors also go to Sentry via
 * worker/observability.ts. Never log document text or personal data: ids and counts only. */
type Fields = Record<string, unknown>;

function log(level: "info" | "warn" | "error", msg: string, fields: Fields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  (level === "error" ? console.error : console.log)(line);
}

export const logger = {
  info: (msg: string, fields?: Fields) => log("info", msg, fields),
  warn: (msg: string, fields?: Fields) => log("warn", msg, fields),
  error: (msg: string, fields?: Fields) => log("error", msg, fields),
};
