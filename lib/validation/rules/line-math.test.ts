import { describe, expect, it } from "vitest";
import { buildRecord } from "../test-builders";
import { lineMath } from "./line-math";

const line = (quantity: string | null, unitPriceCents: number | null, amountCents: number | null) =>
  buildRecord({ lines: [{ position: 2, quantity, unitPriceCents, amountCents }] });

describe("line_math", () => {
  it("quantity × unit price = amount (decimal quantity) → no issue", () => {
    expect(lineMath(line("3.5", 16000, 56000))).toEqual([]);
  });

  it("1¢ off is tolerated, 2¢ is a warning on that line", () => {
    expect(lineMath(line("3.5", 16000, 56001))).toEqual([]);
    expect(lineMath(line("3.5", 16000, 56002))).toEqual([
      expect.objectContaining({
        code: "line_math",
        severity: "warning",
        field: "lines[0].amount_cents",
        details: { position: 2, expected: 56000, actual: 56002 },
      }),
    ]);
  });

  it("skips lines missing quantity, unit price or amount, or with an unparseable quantity", () => {
    expect(lineMath(line(null, 16000, 1))).toEqual([]);
    expect(lineMath(line("2", null, 1))).toEqual([]);
    expect(lineMath(line("2", 100, null))).toEqual([]);
    expect(lineMath(line("two", 100, 1))).toEqual([]);
  });

  it("the fixture invoice's 4 × $46.13 = $184.52 ≠ $184.50 is caught", () => {
    expect(lineMath(buildRecord())).toEqual([expect.objectContaining({ field: "lines[2].amount_cents" })]);
  });
});
