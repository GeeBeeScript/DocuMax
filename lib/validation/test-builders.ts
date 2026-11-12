import type { RecordForValidation, ValidationContext } from "./types";

/** A clean, valid invoice record; override what a test needs. Test helper only. */
export function buildRecord(overrides: Partial<RecordForValidation> = {}): RecordForValidation {
  return {
    id: "rec-1",
    documentType: "invoice",
    supplierName: "Brightline Plumbing Co.",
    invoiceNumber: "INV-2041",
    issueDate: "2026-10-14",
    dueDate: "2026-11-13",
    currency: "USD",
    subtotalCents: 116450,
    taxCents: 9607,
    totalCents: 126057,
    entityId: "ent-1",
    fieldConfidence: {
      supplier_name: 0.97,
      issue_date: 0.97,
      total_cents: 0.99,
      currency: 0.95,
      invoice_number: 0.97,
    },
    lines: [
      { position: 1, quantity: "1", unitPriceCents: 42000, amountCents: 42000 },
      { position: 2, quantity: "3.5", unitPriceCents: 16000, amountCents: 56000 },
      { position: 3, quantity: "4", unitPriceCents: 4613, amountCents: 18450 },
    ],
    ...overrides,
  };
}

export function buildContext(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return { today: "2026-11-14", threshold: 0.85, sameFile: [], candidates: [], ...overrides };
}
