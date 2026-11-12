/**
 * Money primitives. ALL amounts in DocuMax are integer minor units (cents).
 * Never use floats for money; convert at the edges (parsing input, formatting output).
 */

export type Cents = number & { readonly __brand: "Cents" };

export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Cents must be a safe integer, got ${value}`);
  }
  return (value === 0 ? 0 : value) as Cents; // no negative zero
}

/**
 * Parse a printed amount ("1,234.56", "$1,234.56", "1260.57 USD", "-12.5", "(12.50)", "12.50-", "1.234,56") into
 * cents without floating-point arithmetic. Returns null for unparseable input.
 *
 * Separators: the last "," or "." followed by 1–2 digits at the end is the decimal separator ("1.234,56" →
 * 123456); other commas/dots/spaces/apostrophes are thousands separators. A lone comma followed by exactly 3 digits
 * ("1,234") is a thousands separator.
 */
export function parseToCents(input: string): Cents | null {
  let text = input.trim();
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true; // accounting negative
    text = text.slice(1, -1).trim();
  }
  // Strip currency symbols/codes and signs around the number, in either order ("-$12.50", "$-12.50", "12.50- USD").
  const symbols = /^[^\d.,-]+|[^\d.,-]+$/g;
  text = text.replace(symbols, "");
  if (text.endsWith("-")) {
    negative = !negative;
    text = text.slice(0, -1).replace(symbols, "");
  }
  if (text.startsWith("-")) {
    negative = !negative;
    text = text.slice(1).replace(symbols, "");
  }
  text = text.replace(/[\s'\u00a0]/g, "");

  // Whole part: plain digits, or digits in valid thousands groups ("1,234,567" / "1.234.567").
  const validWhole = (w: string) => /^\d*$/.test(w) || /^\d{1,3}([.,]\d{3})+$/.test(w);
  let whole: string;
  let frac = "";
  const decimal = /^(.*?)[.,](\d{1,2})$/.exec(text);
  if (/^\d{1,3}(,\d{3})+$/.test(text)) {
    whole = text; // "1,234" — thousands, not a decimal
  } else if (decimal) {
    [, whole, frac] = decimal;
  } else if (/^\d+\.\d{3,}$/.test(text)) {
    [whole, frac] = text.split("."); // "1.2345" — extra precision, rounded below
  } else {
    whole = text;
  }
  if (!validWhole(whole) || !/^\d*$/.test(frac) || (whole === "" && frac === "")) return null;
  whole = whole.replace(/[.,]/g, "");

  // Round half away from zero on the 3rd decimal.
  const padded = (frac + "000").slice(0, 3);
  let value = Number(whole || "0") * 100 + Number(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) value += 1;
  return cents(negative ? -value : value);
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return cents(total);
}

export function formatCents(value: Cents, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value / 100);
}

/**
 * Exact `unit price × quantity` for a decimal-string quantity ("3.5", "0.125", "-2"), rounded half away from zero to
 * whole cents. Uses BigInt scaling — no floating point. Returns null for an unparseable quantity.
 */
export function multiplyCents(unit: Cents, quantity: string): Cents | null {
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(quantity.trim());
  if (!match) return null;
  const [, sign, whole, frac = ""] = match;
  const scale = BigInt(10) ** BigInt(frac.length);
  const q = BigInt(whole + frac) * BigInt(sign ? -1 : 1);
  const product = BigInt(unit) * q; // in cents × scale
  const zero = BigInt(0);
  const negative = product < zero;
  const abs = negative ? -product : product;
  let rounded = abs / scale;
  if ((abs % scale) * BigInt(2) >= scale) rounded += BigInt(1);
  return cents(Number(negative ? -rounded : rounded));
}

/** Cents → plain decimal string for editing ("126057" → "1260.57", "-5" → "-0.05"). */
export function centsToDecimal(value: Cents): string {
  const negative = value < 0;
  const abs = Math.abs(value);
  return `${negative ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** |a − b| ≤ tolerance, all in cents. */
export function withinCents(a: Cents, b: Cents, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}
