import { cents, type Cents } from "./money";

/**
 * Splitting money. Every function returns shares that sum EXACTLY to the source amount (largest-remainder rounding,
 * exact integer arithmetic via BigInt — no floats). Inputs are validated; invalid input throws AllocationError.
 */

export class AllocationError extends Error {
  constructor(
    message: string,
    readonly code:
      "percent_total" | "percent_range" | "amount_exceeds" | "amount_sign" | "empty" | "duplicate",
  ) {
    super(message);
    this.name = "AllocationError";
  }
}

export interface Share<K extends string = string> {
  key: K;
  cents: Cents;
}

/** 100% in basis points. */
export const FULL_BP = 10_000;

const big = (n: number | bigint) => BigInt(n);
const ZERO = big(0);
const ONE = big(1);

/** Floor division for BigInt (BigInt `/` truncates toward zero). */
function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  return a % b !== ZERO && a < ZERO !== b < ZERO ? q - ONE : q;
}

function assertUniqueKeys(keys: readonly string[]) {
  if (new Set(keys).size !== keys.length)
    throw new AllocationError("Each entity can appear only once.", "duplicate");
}

/**
 * Split `total` in proportion to integer `weights` (any sign, non-zero sum). Each share is the exact quotient rounded
 * down; the leftover cents go one each to the largest fractional remainders (ties → earlier entries).
 * With an all-zero weight sum the whole amount goes to the first entry.
 */
export function allocateByWeights<K extends string>(
  total: Cents,
  weights: readonly { key: K; weight: number | bigint }[],
): Share<K>[] {
  if (weights.length === 0) throw new AllocationError("Nothing to split across.", "empty");
  assertUniqueKeys(weights.map((w) => w.key));
  let ws = weights.map((w) => big(w.weight));
  let sum = ws.reduce((a, b) => a + b, ZERO);
  if (sum === ZERO) return weights.map((w, i) => ({ key: w.key, cents: cents(i === 0 ? total : 0) }));
  if (sum < ZERO) {
    ws = ws.map((w) => -w);
    sum = -sum;
  }
  const t = big(total);
  const floors = ws.map((w) => floorDiv(t * w, sum));
  const fractions = ws.map((w, i) => t * w - floors[i]! * sum); // in [0, sum)
  let leftover = Number(t - floors.reduce((a, b) => a + b, ZERO)); // in [0, n)
  const order = fractions
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (a.f === b.f ? a.i - b.i : a.f > b.f ? -1 : 1));
  const result = floors.slice();
  for (const { i } of order) {
    if (leftover <= 0) break;
    result[i] = result[i]! + ONE;
    leftover--;
  }
  return weights.map((w, i) => ({ key: w.key, cents: cents(Number(result[i])) }));
}

/** Split by percentages in basis points (integers 0–10 000 that total exactly 10 000). */
export function allocateByPercent<K extends string>(
  total: Cents,
  shares: readonly { key: K; percentBp: number }[],
): Share<K>[] {
  if (shares.length === 0) throw new AllocationError("Nothing to split across.", "empty");
  for (const s of shares) {
    if (!Number.isInteger(s.percentBp) || s.percentBp < 0 || s.percentBp > FULL_BP)
      throw new AllocationError("Each percentage must be between 0% and 100%.", "percent_range");
  }
  const sum = shares.reduce((a, s) => a + s.percentBp, 0);
  if (sum !== FULL_BP) throw new AllocationError("Percentages must add up to 100%.", "percent_total");
  return allocateByWeights(
    total,
    shares.map((s) => ({ key: s.key, weight: s.percentBp })),
  );
}

/**
 * Split by fixed amounts. Amounts take the source's sign (or are zero) and together may not exceed it; whatever is
 * left goes to `remainderKey` (appended, or added to that entry if it is already listed).
 */
export function allocateByAmount<K extends string>(
  total: Cents,
  shares: readonly { key: K; amountCents: Cents }[],
  remainderKey: K,
): Share<K>[] {
  if (shares.length === 0) throw new AllocationError("Nothing to split across.", "empty");
  assertUniqueKeys(shares.map((s) => s.key));
  const sign = Math.sign(total);
  for (const s of shares) {
    if (!Number.isSafeInteger(s.amountCents) || (s.amountCents !== 0 && Math.sign(s.amountCents) !== sign))
      throw new AllocationError(
        sign < 0 ? "Amounts must be negative, like the credit." : "Amounts must be positive.",
        "amount_sign",
      );
  }
  const allocated = shares.reduce((a, s) => a + s.amountCents, 0);
  if (Math.abs(allocated) > Math.abs(total))
    throw new AllocationError("The amounts add up to more than the total.", "amount_exceeds");
  const remainder = total - allocated;
  const out: Share<K>[] = shares.map((s) => ({ key: s.key, cents: cents(s.amountCents) }));
  if (remainder === 0) return out;
  const existing = out.find((s) => s.key === remainderKey);
  if (existing) existing.cents = cents(existing.cents + remainder);
  else out.push({ key: remainderKey, cents: cents(remainder) });
  return out;
}

/**
 * "60", "33.33", "12,5 %" → basis points (6000, 3333, 1250) without floating point; null when invalid, > 2 dp or
 * above `maxBp` (100% by default; markups may go higher).
 */
export function parsePercentBp(input: string, maxBp: number = FULL_BP): number | null {
  const m = /^(\d{1,5})(?:[.,](\d{1,2}))?$/.exec(input.trim().replace(/\s*%$/, ""));
  if (!m) return null;
  const bp = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return bp <= maxBp ? bp : null;
}

/** 3333 → "33.33", 6000 → "60". */
export function formatBp(bp: number): string {
  const whole = Math.trunc(bp / 100);
  const frac = Math.abs(bp % 100);
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}
