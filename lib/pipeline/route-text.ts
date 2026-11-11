import { PIPELINE } from "./config";

/** Non-whitespace character count. */
export const visibleChars = (text: string) => text.replace(/\s+/g, "").length;

export function isSparse(text: string, minChars: number = PIPELINE.OCR_MIN_CHARS_PER_PAGE): boolean {
  return visibleChars(text) < minChars;
}

/**
 * Which pages (1-based) need OCR, given each page's text layer. Every sparse page is OCR'd and pages with a real
 * text layer never are, so digital PDFs skip OCR, scans are fully OCR'd and mixed PDFs OCR only their scanned
 * pages (ADR-013 — replaces the earlier "OCR only if > 50% of pages are sparse" rule).
 */
export function pagesNeedingOcr(
  textLayer: readonly string[],
  minChars: number = PIPELINE.OCR_MIN_CHARS_PER_PAGE,
): number[] {
  return textLayer.flatMap((text, i) => (isSparse(text, minChars) ? [i + 1] : []));
}

/** Tidy extracted text: unify newlines, trim line ends, collapse runs of blank lines. */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
