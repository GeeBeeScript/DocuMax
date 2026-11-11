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

  it.each(["", "abc", "1.2.3", "--1"])("rejects %j", (input) => {
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
