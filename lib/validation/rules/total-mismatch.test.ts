import { describe, expect, it } from "vitest";
import { buildRecord } from "../test-builders";
import { totalMismatch } from "./total-mismatch";

describe("total_mismatch", () => {
  it("subtotal + tax = total → no issue", () => {
    expect(totalMismatch(buildRecord())).toEqual([]);
  });

  it("1¢ off is tolerated (rounding on the document)", () => {
    expect(totalMismatch(buildRecord({ totalCents: 126058 }))).toEqual([]);
    expect(totalMismatch(buildRecord({ totalCents: 126056 }))).toEqual([]);
  });

  it("2¢ off is an error with expected/actual amounts", () => {
    expect(totalMismatch(buildRecord({ totalCents: 126059 }))).toEqual([
      expect.objectContaining({
        code: "total_mismatch",
        severity: "error",
        field: "total_cents",
        message: "Subtotal + tax = $1,260.57, but the total is $1,260.59.",
        details: { expected: 126057, actual: 126059 },
      }),
    ]);
  });

  it("works for credit notes and skips when an amount is missing", () => {
    expect(totalMismatch(buildRecord({ subtotalCents: -8500, taxCents: -595, totalCents: -9095 }))).toEqual(
      [],
    );
    expect(totalMismatch(buildRecord({ taxCents: null }))).toEqual([]);
  });
});
