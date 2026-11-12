import { describe, expect, it } from "vitest";
import { cents, centsToDecimal, multiplyCents } from "./money";
import { checkLineMath, checkLinesSum, checkTotal, linesTolerance } from "./totals";

const c = cents;

describe("multiplyCents (exact, no floats)", () => {
  it.each([
    [16000, "3.5", 56000],
    [4613, "4", 18452],
    [1999, "0.5", 1000], // 999.5 → half away from zero
    [-1999, "0.5", -1000],
    [333, "0.333", 111], // 110.889 → 111
    [10, "0.1", 1],
    [1, "0.49", 0],
    [12345, "-2", -24690],
    [99999999, "1000", 99999999000],
  ])("%i¢ × %s = %i¢", (unit, qty, expected) => {
    expect(multiplyCents(c(unit), qty)).toBe(expected);
  });

  it("rejects unparseable quantities", () => {
    expect(multiplyCents(c(100), "two")).toBeNull();
    expect(multiplyCents(c(100), "1,5")).toBeNull();
  });
});

describe("centsToDecimal", () => {
  it.each([
    [126057, "1260.57"],
    [5, "0.05"],
    [-5, "-0.05"],
    [-9095, "-90.95"],
    [0, "0.00"],
  ])("%i → %s", (value, text) => {
    expect(centsToDecimal(c(value))).toBe(text);
  });
});

describe("checkTotal", () => {
  it("passes exact and within 1¢, fails beyond", () => {
    expect(checkTotal(c(116450), c(9607), c(126057))).toEqual({ ok: true, expected: 126057, actual: 126057 });
    expect(checkTotal(c(116450), c(9607), c(126058)).ok).toBe(true);
    expect(checkTotal(c(116450), c(9607), c(126059))).toEqual({
      ok: false,
      expected: 126057,
      actual: 126059,
    });
  });

  it("handles credit notes (negative amounts)", () => {
    expect(checkTotal(c(-8500), c(-595), c(-9095)).ok).toBe(true);
  });
});

describe("checkLinesSum", () => {
  it("tolerance is 1¢ per line, max 5¢", () => {
    expect(linesTolerance(0)).toBe(1);
    expect(linesTolerance(3)).toBe(3);
    expect(linesTolerance(40)).toBe(5);
    expect(checkLinesSum([c(42000), c(56000), c(18450)], c(116450)).ok).toBe(true);
    expect(checkLinesSum([c(42000), c(56000), c(18450)], c(116453)).ok).toBe(true); // 3 lines → 3¢
    expect(checkLinesSum([c(42000), c(56000), c(18450)], c(116454)).ok).toBe(false);
    const many = Array.from({ length: 10 }, () => c(100));
    expect(checkLinesSum(many, c(1005)).ok).toBe(true);
    expect(checkLinesSum(many, c(1006)).ok).toBe(false); // capped at 5¢
  });
});

describe("checkLineMath", () => {
  it("quantity × unit price within 1¢", () => {
    expect(checkLineMath("3.5", c(16000), c(56000))?.ok).toBe(true);
    expect(checkLineMath("3.5", c(16000), c(56001))?.ok).toBe(true);
    expect(checkLineMath("3.5", c(16000), c(56002))).toEqual({ ok: false, expected: 56000, actual: 56002 });
    expect(checkLineMath("n/a", c(16000), c(56000))).toBeNull();
  });
});
