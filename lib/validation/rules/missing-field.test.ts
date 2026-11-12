import { describe, expect, it } from "vitest";
import { buildRecord } from "../test-builders";
import { missingField } from "./missing-field";

describe("missing_field", () => {
  it("a complete invoice has no issues", () => {
    expect(missingField(buildRecord())).toEqual([]);
  });

  it.each([
    ["supplier_name", { supplierName: null }],
    ["supplier_name", { supplierName: "   " }],
    ["issue_date", { issueDate: null }],
    ["total_cents", { totalCents: null }],
    ["currency", { currency: null }],
    ["invoice_number", { invoiceNumber: null }],
  ])("missing %s → error on that field", (field, overrides) => {
    expect(missingField(buildRecord(overrides))).toEqual([
      expect.objectContaining({ code: "missing_field", severity: "error", field }),
    ]);
  });

  it("invoice number is not required for receipts; a zero total is not missing", () => {
    expect(missingField(buildRecord({ documentType: "receipt", invoiceNumber: null }))).toEqual([]);
    expect(missingField(buildRecord({ totalCents: 0 }))).toEqual([]);
  });
});
