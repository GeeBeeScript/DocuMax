import ExcelJS from "exceljs";
import type { ExportColumn } from "./columns";

/**
 * XLSX writer: one sheet per dataset, bold header row, first row frozen, money as numbers with a 2-decimal format
 * (cents → units only here, for display), dates as real dates. Strings are written as text, never formulas.
 */

export interface Sheet<Row> {
  name: string;
  columns: readonly ExportColumn<Row>[];
  rows: readonly Row[];
}

const NUM_FORMATS = { money: "#,##0.00", date: "yyyy-mm-dd", datetime: "yyyy-mm-dd hh:mm" } as const;

function value(type: ExportColumn<unknown>["type"], v: string | number | null): ExcelJS.CellValue {
  if (v == null || v === "") return null;
  if (type === "money") return Number(v) / 100;
  if (type === "number") return Number(v);
  if (type === "date") return new Date(`${String(v).slice(0, 10)}T00:00:00Z`);
  if (type === "datetime") return new Date(String(v));
  return String(v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- sheets of different row types in one workbook
export async function toXlsx(sheets: readonly Sheet<any>[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DocuMax";
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = sheet.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: Math.min(Math.max(c.header.length + 2, c.type === "text" ? 18 : 12), 40),
      style: c.type in NUM_FORMATS ? { numFmt: NUM_FORMATS[c.type as keyof typeof NUM_FORMATS] } : {},
    }));
    ws.getRow(1).font = { bold: true };
    for (const row of sheet.rows) {
      ws.addRow(Object.fromEntries(sheet.columns.map((c) => [c.key, value(c.type, c.value(row))])));
    }
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
