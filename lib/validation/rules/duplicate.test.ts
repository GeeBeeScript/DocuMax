import { describe, expect, it } from "vitest";
import { normalizeInvoiceNumber, normalizeSupplier } from "../normalize";
import { buildContext, buildRecord } from "../test-builders";
import type { DuplicateCandidate } from "../types";
import { duplicate } from "./duplicate";

const candidate = (overrides: Partial<DuplicateCandidate>): DuplicateCandidate => ({
  id: "other",
  supplierName: "Brightline Plumbing Co.",
  invoiceNumber: "INV-9999",
  issueDate: "2026-01-01",
  totalCents: 1,
  fileName: "old.pdf",
  ...overrides,
});
const run = (c: DuplicateCandidate, record = buildRecord()) =>
  duplicate(record, buildContext({ candidates: [c] }));

describe("normalize", () => {
  it.each([
    ["Brightline Plumbing Co., Inc.", "brightline plumbing"],
    ["BRIGHTLINE PLUMBING", "brightline plumbing"],
    ["Harbor & Pine LLC", "harbor and pine"],
    ["Café Müller GmbH", "cafe muller"],
    ["Inc.", null],
  ])("supplier %j → %j", (input, expected) => expect(normalizeSupplier(input)).toBe(expected));

  it.each([
    ["INV-0042", "INV42"],
    ["inv 42", "INV42"],
    ["2026/0815", "20260815"],
    ["000123", "123"],
    ["--", null],
  ])("invoice number %j → %j", (input, expected) => expect(normalizeInvoiceNumber(input)).toBe(expected));
});

describe("duplicate", () => {
  it("same supplier (normalized) + invoice number (normalized) → error on the invoice number", () => {
    const issues = run(candidate({ supplierName: "BRIGHTLINE PLUMBING CO", invoiceNumber: "inv 2041" }));
    expect(issues).toEqual([
      expect.objectContaining({
        code: "duplicate",
        severity: "error",
        field: "invoice_number",
        details: { recordId: "other", matchedBy: "invoice_number" },
      }),
    ]);
  });

  it("same supplier + issue date + total, even with a different invoice number", () => {
    expect(run(candidate({ issueDate: "2026-10-14", totalCents: 126057 }))[0]).toMatchObject({
      details: { matchedBy: "date_total" },
    });
  });

  it("different supplier, or same supplier with different number/date/total → no issue", () => {
    expect(run(candidate({ supplierName: "Summit Supply", invoiceNumber: "INV-2041" }))).toEqual([]);
    expect(run(candidate({}))).toEqual([]);
    expect(run(candidate({ issueDate: "2026-10-14", totalCents: 126056 }))).toEqual([]);
  });

  it("never matches the record itself or records without a supplier", () => {
    expect(run(candidate({ id: "rec-1", invoiceNumber: "INV-2041" }))).toEqual([]);
    expect(run(candidate({ invoiceNumber: "INV-2041" }), buildRecord({ supplierName: null }))).toEqual([]);
  });
});
