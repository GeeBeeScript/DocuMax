import { createHash } from "node:crypto";

/**
 * Fixed-window rate limiting on the Redis the queue already uses (ADR-024). Pure core (`checkLimit`) over a tiny
 * store interface so it is unit-tested without Redis; `limit()` is the server entry point. If Redis is unreachable
 * the request is allowed (availability over strictness) and the error is logged.
 */

export interface CounterStore {
  /** Increment `key`, setting its TTL on first use; returns the new count. */
  hit(key: string, windowSeconds: number): Promise<number>;
}

export interface LimitRule {
  limit: number;
  windowSeconds: number;
}

/** Per-action budgets. Keys combine the rule name with a user id or a hashed IP. */
export const RULES = {
  auth: { limit: 10, windowSeconds: 60 }, // log in / sign up / magic link, per IP
  upload: { limit: 120, windowSeconds: 60 }, // requestUpload, per user
  import: { limit: 10, windowSeconds: 60 },
  report: { limit: 30, windowSeconds: 60 },
  invite: { limit: 30, windowSeconds: 3600 },
  billing: { limit: 10, windowSeconds: 60 },
} satisfies Record<string, LimitRule>;
export type RuleName = keyof typeof RULES;

export interface LimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets (upper bound). */
  retryAfter: number;
}

export async function checkLimit(
  store: CounterStore,
  key: string,
  rule: LimitRule,
  now = Date.now(),
): Promise<LimitResult> {
  const window = Math.floor(now / 1000 / rule.windowSeconds);
  const count = await store.hit(`rl:${key}:${window}`, rule.windowSeconds);
  const retryAfter = rule.windowSeconds - (Math.floor(now / 1000) % rule.windowSeconds);
  return { ok: count <= rule.limit, remaining: Math.max(rule.limit - count, 0), retryAfter };
}

/** IPs are hashed before they become Redis keys (no raw IPs stored). */
export const hashIp = (ip: string) => createHash("sha256").update(ip).digest("hex").slice(0, 24);

export const RATE_LIMITED = "Too many requests. Please wait a minute and try again.";
