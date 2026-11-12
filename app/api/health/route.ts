import IORedis from "ioredis";
import { clientEnv, serverEnv } from "@/lib/env";
import { runChecks } from "@/lib/observability/health";

/**
 * GET /api/health — for uptime monitors and deploy checks. 200 when Supabase (Auth API) and Redis answer, 503
 * otherwise. Reveals only check names and ok/fail.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon } = clientEnv();
  const result = await runChecks({
    database: async () => {
      const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anon }, cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
    },
    redis: async () => {
      const redis = new IORedis(serverEnv().REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        connectTimeout: 1500,
      });
      try {
        await redis.connect();
        await redis.ping();
      } finally {
        redis.disconnect();
      }
    },
  });
  return Response.json(result, {
    status: result.status === "ok" ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
