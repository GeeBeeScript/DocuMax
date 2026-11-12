// @vitest-environment node
import { describe, expect, it } from "vitest";
import { flushObservability, initObservability, reportJobFailure } from "./observability";

describe("worker error reporting", () => {
  it("a failed job reaches Sentry with org/job context and no personal data", async () => {
    const events: Record<string, unknown>[] = [];
    initObservability({
      dsn: "https://public@o0.ingest.sentry.io/0",
      transport: () => ({
        send: async (envelope) => {
          for (const [header, payload] of envelope[1] as [{ type: string }, Record<string, unknown>][]) {
            if (header.type === "event") events.push(payload);
          }
          return {};
        },
        flush: async () => true,
      }),
    });
    reportJobFailure(new Error("render failed for owner@example.com"), {
      queue: "render-report",
      jobId: "report-123",
      orgId: "11111111-1111-4111-8111-111111111111",
      attempt: 3,
      final: true,
    });
    await flushObservability();
    expect(events).toHaveLength(1);
    const event = events[0] as {
      tags: Record<string, string>;
      exception: { values: { value: string }[] };
      contexts: Record<string, unknown>;
    };
    expect(event.tags).toMatchObject({
      queue: "render-report",
      job_id: "report-123",
      org_id: "11111111-1111-4111-8111-111111111111",
      final_attempt: "true",
    });
    expect(event.exception.values[0]!.value).toBe("render failed for [email]");
    expect(event.contexts.job).toEqual({ attempt: 3 });
  });
});
