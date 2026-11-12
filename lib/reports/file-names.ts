import type { Period } from "@/lib/calc/period";
import { isWholeMonth } from "@/lib/calc/period";

/**
 * Download names for reports: readable, safe on every OS, unique within a ZIP. Pure.
 *   "Statement - 12 Elm Street - 2026-10.pdf", "Summary - 2026-10-01 to 2026-11-15.pdf", "Quote Q-2026-0001 - Deck build.pdf"
 */

export function periodSlug(period: Period): string {
  return isWholeMonth(period) ? period.start.slice(0, 7) : `${period.start} to ${period.end}`;
}

/** Strip characters Windows/macOS/zip tools reject, collapse whitespace, cap the length. */
export function safeFileName(name: string, max = 150): string {
  const cleaned = name
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s-]+|[.\s]+$/g, "");
  const base = cleaned.slice(0, max).trim() || "Report";
  return base;
}

const pdf = (name: string) => `${safeFileName(name)}.pdf`;

export const statementFileName = (entityName: string, period: Period) =>
  pdf(`Statement - ${entityName} - ${periodSlug(period)}`);
export const summaryFileName = (period: Period) => pdf(`Summary - ${periodSlug(period)}`);
export const quoteFileName = (number: string | null, entityName: string) =>
  pdf(`Quote${number ? ` ${number}` : ""} - ${entityName}`);
export const batchZipName = (period: Period) => `${safeFileName(`Statements - ${periodSlug(period)}`)}.zip`;

/** Make names unique within one archive: "a.pdf", "a (2).pdf", … (case-insensitive). */
export function uniqueNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf(".");
    const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
    let candidate = name;
    for (let i = 2; used.has(candidate.toLowerCase()); i++) candidate = `${stem} (${i})${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}
