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

// ---------------------------------------------------------------------------------------------------------------
// Aggregation of postings (Phase 7). Inputs come from lib/calc/postings.ts, so allocations are already applied.
// ---------------------------------------------------------------------------------------------------------------

export interface Totals {
  net: Cents;
  tax: Cents;
  gross: Cents;
  /** Distinct records contributing. */
  records: number;
}

interface PostingLike {
  recordId: string;
  netCents: Cents;
  taxCents: Cents;
  grossCents: Cents;
}

export const ZERO_TOTALS: Totals = { net: cents(0), tax: cents(0), gross: cents(0), records: 0 };

export function sumPostings(postings: readonly PostingLike[]): Totals {
  return {
    net: sumCents(postings.map((p) => p.netCents)),
    tax: sumCents(postings.map((p) => p.taxCents)),
    gross: sumCents(postings.map((p) => p.grossCents)),
    records: new Set(postings.map((p) => p.recordId)).size,
  };
}

/** Totals per key, largest gross first (ties by key, so output is stable). */
export function groupTotals<P extends PostingLike, K extends string | null>(
  postings: readonly P[],
  keyOf: (p: P) => K,
): { key: K; totals: Totals }[] {
  const groups = new Map<K, P[]>();
  for (const p of postings) {
    const k = keyOf(p);
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  return [...groups]
    .map(([key, ps]) => ({ key, totals: sumPostings(ps) }))
    .sort(
      (a, b) => b.totals.gross - a.totals.gross || String(a.key ?? "").localeCompare(String(b.key ?? "")),
    );
}

export const addTotals = (a: Totals, b: Totals): Totals => ({
  net: cents(a.net + b.net),
  tax: cents(a.tax + b.tax),
  gross: cents(a.gross + b.gross),
  records: a.records + b.records,
});
