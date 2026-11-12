import { describe, expect, it } from "vitest";
import { checkLimit, hashIp, type CounterStore } from "./rate-limit";

const memory = (): CounterStore & { keys: Map<string, number> } => {
  const keys = new Map<string, number>();
  return { keys, hit: async (k) => keys.set(k, (keys.get(k) ?? 0) + 1).get(k)! };
};

describe("checkLimit", () => {
  it("allows up to the limit within a window, then refuses until the next window", async () => {
    const store = memory();
    const rule = { limit: 3, windowSeconds: 60 };
    const t = Date.UTC(2026, 10, 12, 10, 0, 30);
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await checkLimit(store, "u1", rule, t));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[2]).toMatchObject({ remaining: 0, retryAfter: 30 });
    expect((await checkLimit(store, "u1", rule, t + 31_000)).ok).toBe(true); // next minute
    expect((await checkLimit(store, "u2", rule, t)).ok).toBe(true); // other key
  });

  it("hashes IPs", () => {
    expect(hashIp("203.0.113.7")).toMatch(/^[0-9a-f]{24}$/);
    expect(hashIp("203.0.113.7")).not.toContain("203");
  });
});
