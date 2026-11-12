import { describe, expect, it } from "vitest";
import { buildContext, buildRecord } from "../test-builders";
import { lowConfidence } from "./low-confidence";

describe("low_confidence", () => {
  it("all required fields at or above the threshold → no issue", () => {
    const record = buildRecord({
      fieldConfidence: {
        supplier_name: 0.85,
        issue_date: 0.9,
        total_cents: 1,
        currency: 0.85,
        invoice_number: 0.99,
      },
    });
    expect(lowConfidence(record, buildContext())).toEqual([]);
  });

  it("a required field just below the threshold → warning on that field", () => {
    const record = buildRecord({ fieldConfidence: { ...buildRecord().fieldConfidence, total_cents: 0.84 } });
    expect(lowConfidence(record, buildContext())).toEqual([
      expect.objectContaining({
        code: "low_confidence",
        severity: "warning",
        field: "total_cents",
        details: { confidence: 0.84, threshold: 0.85 },
      }),
    ]);
  });

  it("uses the org's threshold", () => {
    const record = buildRecord({ fieldConfidence: { ...buildRecord().fieldConfidence, total_cents: 0.9 } });
    expect(lowConfidence(record, buildContext({ threshold: 0.95 }))).toHaveLength(1);
  });

  it("ignores optional fields and empty required fields (missing_field covers those)", () => {
    const record = buildRecord({
      currency: null,
      fieldConfidence: { ...buildRecord().fieldConfidence, currency: 0.1, due_date: 0.1 },
    });
    expect(lowConfidence(record, buildContext())).toEqual([]);
  });

  it("a missing confidence entry counts as 0", () => {
    expect(lowConfidence(buildRecord({ fieldConfidence: {} }), buildContext())).toHaveLength(5);
  });
});
