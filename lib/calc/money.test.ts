import { describe, expect, it } from "vitest";
import { cents, formatCents, parseToCents, sumCents } from "./money";

describe("parseToCents", () => {
  it.each([
    ["1234", 123400],
    ["1,234.56", 123456],
    ["$1,234.5", 123450],
    ["0.1", 10],
    ["-12.34", -1234],
    [".99", 99],
    ["0.005", 1],
    ["0.004", 0],
    ["19.999", 2000],
  ])("parses %s → %i", (input, expected) => {
    expect(parseToCents(input)).toBe(expected);
  });

  it.each([
    ["1260.57 USD", 126057],
    ["USD 1,260.57", 126057],
    ["€1.234,56", 123456],
    ["1 234,56", 123456],
    ["1'234.50", 123450],
    ["(12.50)", -1250],
    ["12.50-", -1250],
    ["-$12.50", -1250],
    ["1,234", 123400],
    ["1,234,567.8", 123456780],
    ["0,5", 50],
    ["1.2345", 123],
    ["96.075", 9608],
  ])("parses printed amount %j", (input, expected) => {
    expect(parseToCents(input)).toBe(expected);
  });

  it.each(["", "abc", "1.2.3", "--1", "12a34", "(", "USD"])("rejects %j", (input) => {
    expect(parseToCents(input)).toBeNull();
  });

  it("avoids float drift (0.1 + 0.2)", () => {
    expect(sumCents([parseToCents("0.1")!, parseToCents("0.2")!])).toBe(30);
  });
});

describe("cents", () => {
  it("rejects non-integers", () => {
    expect(() => cents(1.5)).toThrow(RangeError);
  });
});

describe("formatCents", () => {
  it("formats USD", () => {
    expect(formatCents(cents(123456))).toBe("$1,234.56");
  });
});

describe("running totals and rates", () => {
  it("runningTotals accumulates", async () => {
    const { runningTotals, cents } = await import("./money");
    expect(runningTotals([cents(100), cents(-30), cents(5)])).toEqual([100, 70, 75]);
    expect(runningTotals([])).toEqual([]);
  });
  it("applyRateBp rounds half away from zero, exactly", async () => {
    const { applyRateBp, cents } = await import("./money");
    expect(applyRateBp(cents(10000), 1250)).toBe(1250); // 12.5%
    expect(applyRateBp(cents(1), 5000)).toBe(1); // 0.5¢ → 1¢
    expect(applyRateBp(cents(-1), 5000)).toBe(-1);
    expect(applyRateBp(cents(12345), 825)).toBe(1018); // 1018.4625
    expect(applyRateBp(cents(9_000_000_000_000_00), 9999)).toBe(899_910_000_000_000);
    expect(() => applyRateBp(cents(1), 1.5)).toThrow(RangeError);
  });
});
