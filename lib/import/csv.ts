import Papa from "papaparse";
import { uniqueNames } from "@/lib/reports/file-names";

/** Rows per import (larger files: split them). */
export const MAX_IMPORT_ROWS = 5_000;

export interface ParsedCsv {
  headers: string[];
  /** Each row keyed by header. */
  rows: Record<string, string>[];
  /** True when the file had more than MAX_IMPORT_ROWS data rows (the rest are not returned). */
  truncated: boolean;
}

/**
 * CSV text → header + rows. Strips a byte-order mark, trims headers, makes duplicate headers unique ("Total",
 * "Total (2)"), skips blank lines; delimiter auto-detected (comma, semicolon, tab).
 */
export function parseCsv(text: string, maxRows = MAX_IMPORT_ROWS): ParsedCsv {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  const [head = [], ...data] = result.data;
  const headers = uniqueNames(head.map((h, i) => h.trim() || `Column ${i + 1}`));
  const rows = data
    .slice(0, maxRows)
    .map((cells) => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""])));
  return { headers, rows, truncated: data.length > maxRows };
}

/** The error report: one line per problem (row number as in a spreadsheet: the header is row 1). */
export function errorReportCsv(errors: readonly { row: number; column: string; message: string }[]): string {
  return Papa.unparse(
    { fields: ["Row", "Column", "Message"], data: errors.map((e) => [e.row, e.column, e.message]) },
    { newline: "\r\n" },
  );
}
