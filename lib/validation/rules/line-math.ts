import { cents } from "@/lib/calc/money";
import { checkLineMath } from "@/lib/calc/totals";
import { money } from "../messages";
import type { RecordForValidation, ValidationIssue } from "../types";

/** line_math (warning): quantity × unit price ≠ amount (± 1¢), per line that has all three. */
export function lineMath(record: RecordForValidation): ValidationIssue[] {
  return record.lines.flatMap((line, index) => {
    if (line.quantity == null || line.unitPriceCents == null || line.amountCents == null) return [];
    const check = checkLineMath(line.quantity, cents(line.unitPriceCents), cents(line.amountCents));
    if (!check || check.ok) return [];
    return [
      {
        code: "line_math" as const,
        severity: "warning" as const,
        field: `lines[${index}].amount_cents`,
        message: `Line ${line.position}: ${line.quantity} × ${money(line.unitPriceCents, record.currency)} = ${money(check.expected, record.currency)}, but the amount is ${money(check.actual, record.currency)}.`,
        details: { position: line.position, expected: check.expected, actual: check.actual },
      },
    ];
  });
}
