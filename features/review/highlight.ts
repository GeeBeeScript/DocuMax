import { centsToDecimal, type Cents } from "@/lib/calc/money";

/**
 * Which page to open the preview on. Fields aren't traced to pages, so we look for the flagged field's printed
 * value in each page's text (amounts with or without thousands separators). Pure — no I/O.
 */
export interface PageText {
  pageNo: number;
  text: string;
}

type RecordValues = Partial<Record<string, unknown>>;

function needles(field: string, record: RecordValues): string[] {
  const value = record[field];
  if (value == null || value === "") return [];
  if (field.endsWith("_cents") && typeof value === "number") {
    const plain = centsToDecimal(value as Cents).replace(/^-/, "");
    const [int, frac] = plain.split(".");
    const grouped = `${int!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
    return [...new Set([grouped, plain])];
  }
  return typeof value === "string" ? [value] : [];
}

export function highlightPage(
  pages: readonly PageText[],
  record: RecordValues,
  field: string | null,
): number {
  if (!field || pages.length === 0) return 1;
  const search = needles(field.replace(/^lines\[\d+\]\./, ""), record).map((n) => n.toLowerCase());
  if (search.length === 0) return 1;
  const hit = pages.find((p) => search.some((n) => p.text.toLowerCase().includes(n)));
  return hit?.pageNo ?? 1;
}
