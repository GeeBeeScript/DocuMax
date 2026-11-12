import { cents } from "@/lib/calc/money";
import { checkTotal } from "@/lib/calc/totals";
import { money } from "../messages";
import type { RecordForValidation, ValidationIssue } from "../types";

/** total_mismatch (error): subtotal + tax ≠ total (± 1¢). Needs all three amounts. */
export function totalMismatch(record: RecordForValidation): ValidationIssue[] {
  const { subtotalCents, taxCents, totalCents, currency } = record;
  if (subtotalCents == null || taxCents == null || totalCents == null) return [];
  const check = checkTotal(cents(subtotalCents), cents(taxCents), cents(totalCents));
  if (check.ok) return [];
  return [
    {
      code: "total_mismatch",
      severity: "error",
      field: "total_cents",
      message: `Subtotal + tax = ${money(check.expected, currency)}, but the total is ${money(check.actual, currency)}.`,
      details: { expected: check.expected, actual: check.actual },
    },
  ];
}
