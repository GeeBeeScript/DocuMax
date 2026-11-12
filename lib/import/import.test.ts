import { describe, expect, it } from "vitest";
import { entityLabels } from "@/lib/entities/labels";
import { recordColumns } from "@/lib/export/columns";
import { REQUIRED_FIELDS } from "./fields";
import { mappingProblems, normalizeHeader, suggestMapping } from "./mapping";
import { parseRow } from "./rows";

const ctx = {
  entities: [
    { id: "11111111-1111-4111-8111-111111111111", name: "12 Elm Street", code: "ELM" },
    { id: "22222222-2222-4222-8222-222222222222", name: "4 Oak Court", code: null },
  ],
  defaultCurrency: "USD",
};

describe("column mapping", () => {
  it("normalizes headers", () => {
    expect(normalizeHeader("﻿Invoice No.")).toBe("invoice no");
    expect(normalizeHeader("Tax rate (%)")).toBe("tax rate");
    expect(normalizeHeader("Invoice #")).toBe("invoice #");
    expect(normalizeHeader("issue_date")).toBe("issue date");
  });

  it("an exported file maps itself (property and job wording)", () => {
    for (const kind of ["property", "job"] as const) {
      const headers = recordColumns(entityLabels(kind)).map((c) => c.header);
      const m = suggestMapping(headers);
      expect(m).toMatchObject({
        supplier_name: "Supplier",
        invoice_number: "Invoice number",
        issue_date: "Issue date",
        total_cents: "Total",
        subtotal_cents: "Subtotal",
        tax_cents: "Tax",
        tax_rate: "Tax rate (%)",
        entity: kind === "property" ? "Property" : "Job",
        entity_code: kind === "property" ? "Reference" : "Job number",
      });
    }
  });

  it("recognises common bookkeeping headers; saved mappings win; each header is used once", () => {
    const headers = ["Vendor", "Date", "Amount", "VAT", "Bill Number", "Project"];
    expect(suggestMapping(headers)).toMatchObject({
      supplier_name: "Vendor",
      issue_date: "Date",
      total_cents: "Amount",
      tax_cents: "VAT",
      invoice_number: "Bill Number",
      entity: "Project",
      due_date: null,
    });
    expect(suggestMapping(headers, { total_cents: "VAT", tax_cents: "Amount" })).toMatchObject({
      total_cents: "VAT",
      tax_cents: "Amount",
    });
  });

  it("reports missing required fields and unknown headers", () => {
    expect(
      mappingProblems({ supplier_name: "Vendor", issue_date: "Nope" }, ["Vendor"], REQUIRED_FIELDS),
    ).toEqual({
      missing: ["issue_date", "total_cents"].filter((f) => f !== "issue_date").concat([]).length
        ? ["total_cents"]
        : [],
      unknown: ["Nope"],
    });
  });
});

describe("parseRow", () => {
  const mapping = suggestMapping([
    "Supplier",
    "Invoice number",
    "Issue date",
    "Total",
    "Tax",
    "Tax rate (%)",
    "Category",
    "Document type",
    "Property",
    "Reference",
    "Currency",
  ]);
  const row = (over: Record<string, string> = {}) => ({
    Supplier: "Brightline Plumbing",
    "Invoice number": "INV-2041",
    "Issue date": "2026-10-14",
    Total: "1,260.57",
    Tax: "96.07",
    "Tax rate (%)": "8.25%",
    Category: "Repairs & maintenance",
    "Document type": "Invoice",
    Property: "",
    Reference: "elm",
    Currency: "",
    ...over,
  });

  it("parses amounts exactly, labels or codes, entities by code or name, default currency", () => {
    expect(parseRow(row(), mapping, ctx)).toEqual({
      ok: true,
      record: {
        supplier_name: "Brightline Plumbing",
        supplier_tax_id: null,
        invoice_number: "INV-2041",
        document_type: "invoice",
        issue_date: "2026-10-14",
        due_date: null,
        currency: "USD",
        subtotal_cents: null,
        tax_cents: 9607,
        tax_rate: "8.25",
        total_cents: 126057,
        category: "repairs_maintenance",
        entity_id: ctx.entities[0]!.id,
      },
    });
    const r = parseRow(
      row({
        Reference: "",
        Property: "4 oak court",
        Category: "utilities",
        Currency: "eur",
        "Document type": "Credit note",
      }),
      mapping,
      ctx,
    );
    expect(r.ok && r.record).toMatchObject({
      entity_id: ctx.entities[1]!.id,
      category: "utilities",
      currency: "EUR",
      document_type: "credit_note",
    });
  });

  it("strips the export's formula-escape prefix and accepts negative amounts", () => {
    const r = parseRow(row({ "Invoice number": "'-12", Total: "-50.00", Tax: "(0.00)" }), mapping, ctx);
    expect(r.ok && r.record).toMatchObject({ invoice_number: "-12", total_cents: -5000, tax_cents: 0 });
  });

  it("lists every problem with its column; nothing partial is returned", () => {
    const r = parseRow(
      row({
        Supplier: "",
        "Issue date": "14/10/2026",
        Total: "12.34.56",
        Category: "Snacks",
        Reference: "NOPE",
        Currency: "dollars",
        "Tax rate (%)": "abc",
      }),
      mapping,
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toEqual([
      { column: "Supplier", message: "Supplier is required." },
      { column: "Total", message: '"12.34.56" isn\'t an amount like 1260.57.' },
      { column: "Issue date", message: '"14/10/2026" isn\'t a date like 2026-10-14.' },
      { column: "Currency", message: '"dollars" isn\'t a 3-letter currency code like USD.' },
      { column: "Tax rate (%)", message: '"abc" isn\'t a percentage like 8.25.' },
      { column: "Category", message: 'Unknown category "Snacks".' },
      { column: "Reference", message: 'No property or job matches "NOPE".' },
    ]);
  });

  it("required fields that aren't mapped are reported by their label", () => {
    const r = parseRow({ Supplier: "A" }, { supplier_name: "Supplier" }, ctx);
    expect(!r.ok && r.errors.map((e) => e.column)).toEqual(["Total", "Issue date"]);
  });
});

describe("parseCsv", () => {
  it("strips a BOM, detects semicolons, dedupes headers, skips blank lines, caps rows", async () => {
    const { parseCsv, errorReportCsv } = await import("./csv");
    const parsed = parseCsv("﻿Supplier; Total ;Total;\nAcme;1,00;2;x\n\n;;;\nB;3;4;\n", 1);
    expect(parsed.headers).toEqual(["Supplier", "Total", "Total (2)", "Column 4"]);
    expect(parsed.rows).toEqual([{ Supplier: "Acme", Total: "1,00", "Total (2)": "2", "Column 4": "x" }]);
    expect(parsed.truncated).toBe(true);
    expect(errorReportCsv([{ row: 3, column: "Total", message: 'Bad "amount"' }])).toBe(
      'Row,Column,Message\r\n3,Total,"Bad ""amount"""',
    );
  });
});
