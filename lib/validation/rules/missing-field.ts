import { FIELD_LABELS, requiredFields } from "../required-fields";
import type { RecordForValidation, ValidationIssue } from "../types";

const VALUE: Record<string, (r: RecordForValidation) => unknown> = {
  supplier_name: (r) => r.supplierName,
  issue_date: (r) => r.issueDate,
  total_cents: (r) => r.totalCents,
  currency: (r) => r.currency,
  invoice_number: (r) => r.invoiceNumber,
};

/** missing_field (error): a required field is empty. Invoice number is required for invoices only. */
export function missingField(record: RecordForValidation): ValidationIssue[] {
  return requiredFields(record.documentType)
    .filter((field) => {
      const value = VALUE[field](record);
      return value == null || (typeof value === "string" && value.trim() === "");
    })
    .map((field) => ({
      code: "missing_field" as const,
      severity: "error" as const,
      field,
      message: `${FIELD_LABELS[field]} is missing.`,
    }));
}
