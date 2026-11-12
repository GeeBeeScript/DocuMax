import "server-only";
import { headers } from "next/headers";
import IORedis from "ioredis";
import { serverEnv } from "@/lib/env";
import { checkLimit, hashIp, RULES, type CounterStore, type RuleName } from "./rate-limit";

let redis: IORedis | null = null;

const store: CounterStore = {
  async hit(key, windowSeconds) {
    redis ??= new IORedis(serverEnv().REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    const [[, count]] = (await redis.multi().incr(key).expire(key, windowSeconds, "NX").exec()) as [
      [null, number],
    ];
    return count;
  },
};

/** The client IP as the platform reports it (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * True when the call may proceed. `id` is a user id, or omitted to limit by the caller's IP. Fails open when Redis
 * is down.
 */
export async function allow(rule: RuleName, id?: string): Promise<boolean> {
  if (process.env.RATE_LIMIT_DISABLED === "1") return true;
  const key = `${rule}:${id ?? `ip:${hashIp(await clientIp())}`}`;
  try {
    return (await checkLimit(store, key, RULES[rule])).ok;
  } catch (error) {
    console.error("rate limit unavailable", { rule, message: (error as Error).message });
    return true;
  }
}
