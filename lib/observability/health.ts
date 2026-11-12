/** Liveness/readiness checks for /api/health (pure orchestration; checks are injected). */

export type CheckResult = "ok" | "fail";

export async function runChecks(
  checks: Record<string, () => Promise<unknown>>,
  timeoutMs = 2000,
): Promise<{ status: "ok" | "degraded"; checks: Record<string, CheckResult> }> {
  const entries = await Promise.all(
    Object.entries(checks).map(async ([name, check]) => {
      try {
        await Promise.race([
          check(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
        ]);
        return [name, "ok"] as const;
      } catch {
        return [name, "fail"] as const;
      }
    }),
  );
  const results = Object.fromEntries(entries) as Record<string, CheckResult>;
  return { status: entries.every(([, r]) => r === "ok") ? "ok" : "degraded", checks: results };
}
