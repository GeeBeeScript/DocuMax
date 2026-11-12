import { describe, expect, it } from "vitest";
import { runChecks } from "./health";

describe("runChecks", () => {
  it("reports each check and degrades on failure or timeout", async () => {
    const result = await runChecks(
      {
        database: async () => true,
        redis: async () => {
          throw new Error("down");
        },
        slow: () => new Promise((r) => setTimeout(r, 200)),
      },
      50,
    );
    expect(result).toEqual({ status: "degraded", checks: { database: "ok", redis: "fail", slow: "fail" } });
    expect((await runChecks({ a: async () => 1 })).status).toBe("ok");
  });
});
