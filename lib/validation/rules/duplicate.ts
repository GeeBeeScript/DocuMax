import { normalizeInvoiceNumber, normalizeSupplier } from "../normalize";
import type { DuplicateCandidate, RecordForValidation, ValidationContext, ValidationIssue } from "../types";

/**
 * duplicate (error): same normalized supplier + invoice number, or same supplier + issue date + total, as another
 * record in the org.
 */
export function duplicate(record: RecordForValidation, ctx: ValidationContext): ValidationIssue[] {
  const supplier = normalizeSupplier(record.supplierName);
  if (!supplier) return [];
  const invoice = normalizeInvoiceNumber(record.invoiceNumber);

  const match = (c: DuplicateCandidate): "invoice_number" | "date_total" | null => {
    if (c.id === record.id || normalizeSupplier(c.supplierName) !== supplier) return null;
    if (invoice && normalizeInvoiceNumber(c.invoiceNumber) === invoice) return "invoice_number";
    if (
      record.issueDate &&
      record.totalCents != null &&
      c.issueDate === record.issueDate &&
      c.totalCents === record.totalCents
    ) {
      return "date_total";
    }
    return null;
  };

  for (const candidate of ctx.candidates) {
    const by = match(candidate);
    if (!by) continue;
    const what =
      by === "invoice_number" ? "the same supplier and invoice number" : "the same supplier, date and total";
    return [
      {
        code: "duplicate",
        severity: "error",
        field: by === "invoice_number" ? "invoice_number" : null,
        message: `Possible duplicate: ${what} as ${candidate.fileName ? `“${candidate.fileName}”` : "another record"}.`,
        details: { recordId: candidate.id, matchedBy: by },
      },
    ];
  }
  return [];
}
