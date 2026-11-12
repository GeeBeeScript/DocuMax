import { FIELD_LABELS, requiredFields } from "../required-fields";
import type { RecordForValidation, ValidationContext, ValidationIssue } from "../types";

const HAS_VALUE: Record<string, (r: RecordForValidation) => boolean> = {
  supplier_name: (r) => !!r.supplierName,
  issue_date: (r) => !!r.issueDate,
  total_cents: (r) => r.totalCents != null,
  currency: (r) => !!r.currency,
  invoice_number: (r) => !!r.invoiceNumber,
};

/**
 * low_confidence (warning): a required field with a value is below the org's review threshold. Empty fields are
 * reported by missing_field instead. Corrected fields have confidence 1.
 */
export function lowConfidence(record: RecordForValidation, ctx: ValidationContext): ValidationIssue[] {
  return requiredFields(record.documentType)
    .filter((field) => HAS_VALUE[field](record) && (record.fieldConfidence[field] ?? 0) < ctx.threshold)
    .map((field) => {
      const confidence = record.fieldConfidence[field] ?? 0;
      return {
        code: "low_confidence" as const,
        severity: "warning" as const,
        field,
        message: `${FIELD_LABELS[field]} was read with low confidence (${Math.round(confidence * 100)}%). Check it against the document.`,
        details: { confidence, threshold: ctx.threshold },
      };
    });
}
