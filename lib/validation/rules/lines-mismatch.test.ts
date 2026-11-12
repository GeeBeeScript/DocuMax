import { describe, expect, it } from "vitest";
import { buildRecord } from "../test-builders";
import { linesMismatch } from "./lines-mismatch";

describe("lines_mismatch", () => {
  it("lines add up to the subtotal → no issue", () => {
    expect(linesMismatch(buildRecord())).toEqual([]);
  });

  it("tolerance is 1¢ per line (3 lines → 3¢)", () => {
    expect(linesMismatch(buildRecord({ subtotalCents: 116453 }))).toEqual([]);
    expect(linesMismatch(buildRecord({ subtotalCents: 116454 }))).toEqual([
      expect.objectContaining({
        code: "lines_mismatch",
        severity: "warning",
        details: { expected: 116450, actual: 116454 },
      }),
    ]);
  });

  it("tolerance is capped at 5¢", () => {
    const lines = Array.from({ length: 10 }, (_, i) => ({
      position: i + 1,
      quantity: null,
      unitPriceCents: null,
      amountCents: 100,
    }));
    expect(linesMismatch(buildRecord({ lines, subtotalCents: 1005 }))).toEqual([]);
    expect(linesMismatch(buildRecord({ lines, subtotalCents: 1006 }))).toHaveLength(1);
  });

  it("skips without lines, without a subtotal, or with an unknown line amount", () => {
    expect(linesMismatch(buildRecord({ lines: [] }))).toEqual([]);
    expect(linesMismatch(buildRecord({ subtotalCents: null }))).toEqual([]);
    expect(
      linesMismatch(
        buildRecord({ lines: [{ position: 1, quantity: null, unitPriceCents: null, amountCents: null }] }),
      ),
    ).toEqual([]);
  });
});
