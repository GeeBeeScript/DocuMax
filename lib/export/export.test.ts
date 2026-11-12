// @vitest-environment node
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { entityLabels } from "@/lib/entities/labels";
import { lineColumns, recordColumns, type ExportRecord } from "./columns";
import { escapeFormula, toCsv, unescapeFormula } from "./csv";
import { toXlsx } from "./xlsx";

const record: ExportRecord = {
  id: "r1",
  status: "needs_review",
  documentType: "credit_note",
  supplierName: '=HYPERLINK("http://evil")',
  supplierTaxId: null,
  invoiceNumber: "-12",
  issueDate: "2026-10-14",
  dueDate: null,
  currency: "USD",
  subtotalCents: -5000,
  taxCents: 0,
  taxRate: "8.25",
  totalCents: -5000,
  category: "repairs_maintenance",
  entityName: '12 Elm, "rear"',
  entityCode: "ELM",
  fileName: null,
  approvedAt: null,
  createdAt: "2026-11-01T09:30:00Z",
};
const columns = recordColumns(entityLabels("property"));

describe("formula escaping", () => {
  it("prefixes dangerous text and undoes it", () => {
    for (const v of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"]) {
      expect(escapeFormula(v)).toBe(`'${v}`);
      expect(unescapeFormula(escapeFormula(v))).toBe(v);
    }
    expect(escapeFormula("Acme")).toBe("Acme");
    expect(unescapeFormula("'quoted")).toBe("'quoted"); // only our own prefix is removed
  });
});

describe("CSV export", () => {
  it("writes headers, plain decimals, ISO dates, labels; escapes text but not numbers", () => {
    const csv = toCsv(columns, [record]);
    const [header, row] = Papa.parse<string[]>(csv, { skipEmptyLines: true }).data;
    expect(header).toEqual(columns.map((c) => c.header));
    const get = (h: string) => row![header!.indexOf(h)];
    expect(get("Supplier")).toBe('\'=HYPERLINK("http://evil")');
    expect(get("Invoice number")).toBe("'-12");
    expect(get("Total")).toBe("-50.00"); // a negative amount stays a number
    expect(get("Tax rate (%)")).toBe("8.25");
    expect(get("Issue date")).toBe("2026-10-14");
    expect(get("Document type")).toBe("Credit note");
    expect(get("Category")).toBe("Repairs & maintenance");
    expect(get("Property")).toBe('12 Elm, "rear"'); // quoting handled by the CSV writer
    expect(get("Due date")).toBe("");
    expect(csv).toContain("\r\n");
  });
});

describe("XLSX export", () => {
  it("one sheet per dataset, bold frozen header, money as formatted numbers, dates as dates", async () => {
    const bytes = await toXlsx([
      { name: "Records", columns, rows: [record] },
      { name: "Line items", columns: lineColumns, rows: [] },
    ]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Records", "Line items"]);
    const ws = wb.getWorksheet("Records")!;
    expect(ws.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(ws.getRow(1).font?.bold).toBe(true);
    const col = (header: string) => columns.findIndex((c) => c.header === header) + 1;
    expect(ws.getRow(2).getCell(col("Total")).value).toBe(-50);
    expect(ws.getRow(2).getCell(col("Total")).numFmt).toBe("#,##0.00");
    expect(ws.getRow(2).getCell(col("Issue date")).value).toEqual(new Date("2026-10-14T00:00:00Z"));
    expect(ws.getRow(2).getCell(col("Supplier")).value).toBe('=HYPERLINK("http://evil")'); // text, not a formula
    expect(ws.getRow(2).getCell(col("Supplier")).type).toBe(ExcelJS.ValueType.String);
  });
});
