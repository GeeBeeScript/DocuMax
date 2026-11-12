/** Normalization for duplicate detection (docs/DOCUMENT_PIPELINE.md → Stage 3). */

const LEGAL_SUFFIXES = new Set([
  "inc",
  "incorporated",
  "llc",
  "llp",
  "ltd",
  "limited",
  "co",
  "corp",
  "corporation",
  "company",
  "gmbh",
  "ag",
  "sa",
  "sarl",
  "bv",
  "nv",
  "plc",
  "pty",
  "pllc",
  "lp",
  "the",
]);

/** "Brightline Plumbing Co., Inc." → "brightline plumbing" */
export function normalizeSupplier(name: string | null): string | null {
  if (!name) return null;
  const words = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w && !LEGAL_SUFFIXES.has(w));
  return words.length ? words.join(" ") : null;
}

/** "inv-0042" → "INV42": upper-case, letters/digits only, leading zeros of number groups dropped. */
export function normalizeInvoiceNumber(value: string | null): string | null {
  if (!value) return null;
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const normalized = compact.replace(/(^|[A-Z])0+(?=\d)/g, "$1");
  return normalized || null;
}
