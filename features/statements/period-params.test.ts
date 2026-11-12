import { describe, expect, it } from "vitest";
import { parsePeriodParams, periodQuery } from "./period-params";

const now = new Date("2026-11-01T03:00:00Z");

describe("period params", () => {
  it("defaults to the current month in the org's time zone", () => {
    expect(parsePeriodParams({}, "America/New_York", now)).toEqual({
      period: { start: "2026-10-01", end: "2026-10-31" },
      mode: "month",
      error: null,
    });
  });

  it("reads a month or a custom range", () => {
    expect(parsePeriodParams({ month: "2026-02" }, "UTC", now).period).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
    expect(parsePeriodParams({ from: "2026-10-10", to: "2026-11-05" }, "UTC", now)).toMatchObject({
      period: { start: "2026-10-10", end: "2026-11-05" },
      mode: "custom",
    });
  });

  it("falls back with a message on bad input", () => {
    expect(parsePeriodParams({ month: "2026-13" }, "UTC", now)).toMatchObject({
      mode: "month",
      error: /month like/,
    });
    expect(parsePeriodParams({ from: "2026-11-05", to: "2026-10-01" }, "UTC", now).error).toMatch(/before/);
    expect(parsePeriodParams({ from: "2026-11-05" }, "UTC", now).error).toMatch(/dates like/);
  });

  it("builds query strings", () => {
    expect(periodQuery({ start: "2026-10-01", end: "2026-10-31" }, "month")).toBe("?month=2026-10");
    expect(periodQuery({ start: "2026-10-10", end: "2026-11-05" }, "custom")).toBe(
      "?from=2026-10-10&to=2026-11-05",
    );
  });
});
