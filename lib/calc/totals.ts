import { cents, multiplyCents, sumCents, withinCents, type Cents } from "./money";

/**
 * Document-level checks used by validation (docs/DOCUMENT_PIPELINE.md → Stage 3). All amounts in cents; every
 * function returns the computed figures so callers can show "expected X, found Y" without doing math themselves.
 */

export interface TotalCheck {
  ok: boolean;
  expected: Cents;
  actual: Cents;
}

/** subtotal + tax = total (± 1¢). */
export function checkTotal(subtotal: Cents, tax: Cents, total: Cents, toleranceCents = 1): TotalCheck {
  const expected = cents(subtotal + tax);
  return { ok: withinCents(expected, total, toleranceCents), expected, actual: total };
}

/** Lines tolerance: 1¢ per line, at most 5¢. */
export const linesTolerance = (lineCount: number) => Math.min(Math.max(lineCount, 1), 5);

/** Σ line amounts = subtotal (± 1¢ × lines, max 5¢). */
export function checkLinesSum(lineAmounts: readonly Cents[], subtotal: Cents): TotalCheck {
  const expected = sumCents(lineAmounts);
  return {
    ok: withinCents(expected, subtotal, linesTolerance(lineAmounts.length)),
    expected,
    actual: subtotal,
  };
}

/** quantity × unit price = amount (± 1¢). Null when the quantity can't be parsed. */
export function checkLineMath(quantity: string, unitPrice: Cents, amount: Cents): TotalCheck | null {
  const expected = multiplyCents(unitPrice, quantity);
  if (expected == null) return null;
  return { ok: withinCents(expected, amount, 1), expected, actual: amount };
}
