import Papa from "papaparse";
import { centsToDecimal, type Cents } from "@/lib/calc/money";
import type { ExportColumn } from "./columns";

/**
 * CSV writer. Money as plain decimals ("1260.57", no symbol or separators) and dates as ISO, so a file re-imports
 * exactly. Text that a spreadsheet would run as a formula (starting with = + - @ tab or CR) is prefixed with an
 * apostrophe; numbers are never touched (a negative amount stays a number). The import strips the prefix again.
 */

const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

/** Undo `escapeFormula` (used by the CSV import). */
export function unescapeFormula(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

export function cell(type: ExportColumn<unknown>["type"], value: string | number | null): string {
  if (value == null || value === "") return "";
  if (type === "money") return centsToDecimal(value as Cents);
  if (type === "number") return String(value);
  return escapeFormula(String(value));
}

export function toCsv<Row>(columns: readonly ExportColumn<Row>[], rows: readonly Row[]): string {
  return Papa.unparse(
    {
      fields: columns.map((c) => escapeFormula(c.header)),
      data: rows.map((row) => columns.map((c) => cell(c.type, c.value(row)))),
    },
    { newline: "\r\n" },
  );
}
