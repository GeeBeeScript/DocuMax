import { describe, expect, it } from "vitest";
import { buildContext, buildRecord } from "../test-builders";
import { dateSuspicious, monthsBefore } from "./date-suspicious";

const ctx = buildContext({ today: "2026-11-14" });

describe("date_suspicious", () => {
  it("normal dates → no issue", () => {
    expect(dateSuspicious(buildRecord(), ctx)).toEqual([]);
  });

  it("today is fine; tomorrow is in the future", () => {
    expect(dateSuspicious(buildRecord({ issueDate: "2026-11-14", dueDate: null }), ctx)).toEqual([]);
    expect(dateSuspicious(buildRecord({ issueDate: "2026-11-15", dueDate: null }), ctx)).toEqual([
      expect.objectContaining({
        code: "date_suspicious",
        severity: "warning",
        field: "issue_date",
        message: "The issue date is in the future.",
      }),
    ]);
  });

  it("exactly 18 months old is fine; one day older is flagged", () => {
    expect(monthsBefore("2026-11-14", 18)).toBe("2025-05-14");
    expect(dateSuspicious(buildRecord({ issueDate: "2025-05-14", dueDate: null }), ctx)).toEqual([]);
    expect(dateSuspicious(buildRecord({ issueDate: "2025-05-13", dueDate: null }), ctx)[0]).toMatchObject({
      field: "issue_date",
    });
  });

  it("due before issue is flagged on the due date; same day is fine", () => {
    expect(dateSuspicious(buildRecord({ dueDate: "2026-10-13" }), ctx)).toEqual([
      expect.objectContaining({ field: "due_date" }),
    ]);
    expect(dateSuspicious(buildRecord({ dueDate: "2026-10-14" }), ctx)).toEqual([]);
  });

  it("monthsBefore clamps to month end", () => {
    expect(monthsBefore("2026-08-31", 18)).toBe("2025-02-28");
  });
});
