import { describe, expect, it } from "vitest";
import { cents } from "@/lib/calc/money";
import type { MappedRecord } from "@/lib/pipeline/map-extraction";
import { sameSupplier, scoreFields, summarize } from "./eval-scoring";

const record = (overrides: Partial<MappedRecord>) =>
  ({
    supplier_name: "Brightline Plumbing Co.",
    invoice_number: "INV-2041",
    issue_date: "2026-10-14",
    total_cents: 126057,
    currency: null,
    ...overrides,
  }) as MappedRecord;
const expected = {
  documentType: "invoice",
  supplierName: "Brightline Plumbing Co.",
  invoiceNumber: "INV-2041",
  issueDate: "2026-10-14",
  totalCents: 126057,
  currency: null,
};

describe("eval scoring", () => {
  it("all required fields equal → correct", () => {
    expect(Object.values(scoreFields(record({}), expected)).every(Boolean)).toBe(true);
  });

  it("tolerates cosmetic differences but not wrong values", () => {
    expect(sameSupplier("BRIGHTLINE PLUMBING CO", "Brightline Plumbing Co.")).toBe(true);
    expect(sameSupplier("Brightline Plumbing", "Summit Supply Co.")).toBe(false);
    expect(scoreFields(record({ invoice_number: "inv 2041" }), expected).invoiceNumber).toBe(true);
    expect(scoreFields(record({ total_cents: cents(126056) }), expected).totalCents).toBe(false);
  });

  it("a guessed value where the document prints none is wrong", () => {
    expect(scoreFields(record({ currency: "USD" }), expected).currency).toBe(false);
    expect(sameSupplier(null, "X")).toBe(false);
    expect(sameSupplier(null, null)).toBe(true);
  });

  it("summarizes fixture accuracy and per-field accuracy", () => {
    const yes = {
      supplierName: true,
      invoiceNumber: true,
      issueDate: true,
      totalCents: true,
      currency: true,
    };
    const s = summarize([
      { file: "a", fields: yes, correct: true },
      { file: "b", fields: { ...yes, currency: false }, correct: false },
    ]);
    expect(s).toMatchObject({ fixtures: 2, correct: 1, accuracy: 0.5 });
    expect(s.perField.currency).toBe(0.5);
    expect(s.perField.totalCents).toBe(1);
  });
});
