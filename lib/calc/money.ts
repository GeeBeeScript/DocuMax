/**
 * Money primitives. ALL amounts in DocuMax are integer minor units (cents).
 * Never use floats for money; convert at the edges (parsing input, formatting output).
 */

export type Cents = number & { readonly __brand: "Cents" };

export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Cents must be a safe integer, got ${value}`);
  }
  return value as Cents;
}

/**
 * Parse a decimal string ("1,234.56", "-12.5", "1234") into cents without
 * floating-point arithmetic. Returns null for unparseable input.
 */
export function parseToCents(input: string): Cents | null {
  const cleaned = input
    .trim()
    .replace(/[\s,]/g, "")
    .replace(/^[^\d.-]+/, "");
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) return null;
  const [, sign, whole = "", frac = ""] = match;
  if (whole === "" && frac === "") return null;

  // Round half away from zero on the 3rd decimal.
  const padded = (frac + "000").slice(0, 3);
  let value = Number(whole || "0") * 100 + Number(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) value += 1;
  return cents(sign ? -value : value);
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return cents(total);
}

export function formatCents(value: Cents, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value / 100);
}
