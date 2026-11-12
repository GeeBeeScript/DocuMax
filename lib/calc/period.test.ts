import { describe, expect, it } from "vitest";
import {
  currentMonth,
  inPeriod,
  isIsoDate,
  monthPeriod,
  monthsIn,
  periodError,
  periodLabel,
  previousPeriod,
  shiftMonth,
  todayIn,
} from "./period";

describe("periods", () => {
  it("month boundaries incl. leap years", () => {
    expect(monthPeriod("2026-10-14")).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(monthPeriod("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(monthPeriod("2026-02-10").end).toBe("2026-02-28");
  });

  it("today and the current month follow the org's time zone", () => {
    const now = new Date("2026-11-01T03:30:00Z"); // still Oct 31 in Los Angeles
    expect(todayIn("UTC", now)).toBe("2026-11-01");
    expect(todayIn("America/Los_Angeles", now)).toBe("2026-10-31");
    expect(currentMonth("America/Los_Angeles", now)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(todayIn("Not/AZone", now)).toBe("2026-11-01");
  });

  it("shifts and previous periods across year ends", () => {
    expect(shiftMonth(monthPeriod("2026-01"), -1)).toEqual({ start: "2025-12-01", end: "2025-12-31" });
    expect(shiftMonth(monthPeriod("2026-11"), 2).start).toBe("2027-01-01");
    expect(previousPeriod(monthPeriod("2026-03"))).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(previousPeriod({ start: "2026-10-10", end: "2026-10-19" })).toEqual({
      start: "2026-09-30",
      end: "2026-10-09",
    });
  });

  it("iterates months and tests membership", () => {
    expect(monthsIn({ start: "2026-11-15", end: "2027-01-02" }).map((m) => m.start)).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
    ]);
    expect(inPeriod("2026-10-31", monthPeriod("2026-10"))).toBe(true);
    expect(inPeriod("2026-11-01", monthPeriod("2026-10"))).toBe(false);
    expect(inPeriod(null, monthPeriod("2026-10"))).toBe(false);
  });

  it("validates and labels periods", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(periodError({ start: "2026-10-31", end: "2026-10-01" })).toMatch(/before/);
    expect(periodError({ start: "2026-13-01", end: "2026-12-01" })).toMatch(/dates like/);
    expect(periodError({ start: "2010-01-01", end: "2026-01-01" })).toMatch(/five years/);
    expect(periodError(monthPeriod("2026-10"))).toBeNull();
    expect(periodLabel(monthPeriod("2026-10"))).toBe("October 2026");
    expect(periodLabel({ start: "2026-10-01", end: "2026-11-15" })).toBe("Oct 1 – Nov 15, 2026");
    expect(periodLabel({ start: "2025-12-20", end: "2026-01-05" })).toBe("Dec 20, 2025 – Jan 5, 2026");
  });
});
