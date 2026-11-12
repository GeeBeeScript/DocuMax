import { cents } from "@/lib/calc/money";
import { checkLinesSum } from "@/lib/calc/totals";
import { money } from "../messages";
import type { RecordForValidation, ValidationIssue } from "../types";

/** lines_mismatch (warning): Σ line amounts ≠ subtotal (± 1¢ per line, max 5¢). Needs lines and a subtotal. */
export function linesMismatch(record: RecordForValidation): ValidationIssue[] {
  const amounts = record.lines.map((l) => l.amountCents);
  if (record.subtotalCents == null || amounts.length === 0 || amounts.some((a) => a == null)) return [];
  const check = checkLinesSum(
    amounts.map((a) => cents(a!)),
    cents(record.subtotalCents),
  );
  if (check.ok) return [];
  return [
    {
      code: "lines_mismatch",
      severity: "warning",
      field: "subtotal_cents",
      message: `Line items add up to ${money(check.expected, record.currency)}, but the subtotal is ${money(check.actual, record.currency)}.`,
      details: { expected: check.expected, actual: check.actual },
    },
  ];
}
