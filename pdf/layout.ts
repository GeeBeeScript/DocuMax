/**
 * Print layout in millimetres. Every block of a report has a FIXED height (print.css uses the same numbers via
 * `mm()`), so pagination is decided here — deterministically and testably — instead of by the browser: tables are
 * split into per-page chunks with repeated headers, no row is ever cut, and each break shows carried-forward /
 * brought-forward subtotals (figures from lib/calc). See ADR-021.
 */

export const PAGE = {
  width: 210,
  height: 297,
  marginTop: 26,
  marginBottom: 18,
  marginX: 16,
} as const;

/** Usable body height per page (with a small safety margin for rounding in the browser). */
export const BODY_HEIGHT = PAGE.height - PAGE.marginTop - PAGE.marginBottom - 3;
export const BODY_WIDTH = PAGE.width - 2 * PAGE.marginX;

export const H = {
  title: 30,
  gap: 6,
  tiles: 20,
  heading: 9,
  head: 8,
  row: 7,
  /** Carried / brought forward rows. */
  carry: 7,
  /** Totals block under a table: three 7 mm rows + 2 mm rule. */
  totals: 23,
  note: 8,
  notes: 30,
} as const;

export const mm = (value: number) => `${value}mm`;

export interface TableChunk {
  /** 0-based page index. */
  page: number;
  /** Row range [start, end). */
  start: number;
  end: number;
  first: boolean;
  last: boolean;
}

export interface Pagination {
  chunks: TableChunk[];
  pageCount: number;
}

/**
 * Split a table of `rows` rows over pages. `before` = height already used on page 1 above the table; `after` = height
 * that must follow the last row on the same page (totals, notes). The first chunk carries the section heading.
 * A chunk never ends exactly at the last row without room for `after` (the totals never sit alone on a page), and
 * a page never starts a table with fewer than one row.
 */
export function paginateTable({
  rows,
  before,
  after,
  body = BODY_HEIGHT,
}: {
  rows: number;
  before: number;
  after: number;
  body?: number;
}): Pagination {
  const chunks: TableChunk[] = [];
  let page = 0;
  let available = body - before;
  let start = 0;
  const shown = Math.max(rows, 1); // an empty table still renders one "no rows" row
  for (let guard = 0; guard < 10_000; guard++) {
    const first = chunks.length === 0;
    const overhead = (first ? H.heading : 0) + H.head + (first ? 0 : H.carry);
    const remaining = shown - start;
    if (overhead + remaining * H.row + after <= available) {
      chunks.push({ page, start, end: rows === 0 ? 0 : shown, first, last: true });
      return { chunks, pageCount: page + 1 };
    }
    let k = Math.floor((available - overhead - H.carry) / H.row);
    if (k >= remaining) k = remaining - 1; // keep at least one row for the page with the totals
    if (k >= 1) {
      chunks.push({ page, start, end: start + k, first, last: false });
      start += k;
    }
    page += 1;
    available = body;
  }
  throw new Error("pagination did not converge");
}
