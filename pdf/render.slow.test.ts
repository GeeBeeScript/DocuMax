// @vitest-environment node
import { extractText, getDocumentProxy } from "unpdf";
import { afterAll, describe, expect, it } from "vitest";
import { monthPeriod } from "@/lib/calc/period";
import { buildQuote } from "@/lib/calc/quote";
import { buildPortfolio, buildStatement, type StatementRecord } from "@/lib/calc/statement";
import { closeBrowser, renderPdf } from "@/worker/pdf/render";
import { renderReport } from "./document";
import { monthlyStatement } from "./templates/monthly-statement";
import { portfolioSummary } from "./templates/portfolio-summary";
import { quote } from "./templates/quote";

/** Real Chromium renders (npm run test:slow). Asserts what the reader sees on each page of the PDF. */

const branding = {
  orgName: "Harbor & Pine PM",
  logoDataUri: null,
  brandColor: "#2f6fff",
  footerText: "Harbor & Pine · 1 Main St",
};
const october = monthPeriod("2026-10");
const entity = {
  id: "elm",
  name: "12 Elm Street",
  code: "ELM",
  address: "12 Elm Street, Springfield",
  clientName: "J. Rivera",
};

function records(n: number): StatementRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${String(i).padStart(4, "0")}`,
    status: "approved",
    documentType: "invoice",
    supplierName: `Supplier ${i % 7}`,
    invoiceNumber: `INV${String(i + 1).padStart(4, "0")}`, // no hyphen: unpdf drops it when extracting text
    issueDate: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
    currency: "USD",
    category: ["repairs_maintenance", "utilities", "cleaning", "landscaping"][i % 4]!,
    entityId: "elm",
    taxCents: 800 + i,
    totalCents: 10_000 + i * 137,
    lines: [],
    allocations: [],
  }));
}

async function pagesOf(pdf: Uint8Array) {
  const doc = await getDocumentProxy(pdf);
  const { text } = await extractText(doc, { mergePages: false });
  return text as string[];
}

afterAll(() => closeBrowser());

describe("monthly statement PDF", () => {
  for (const n of [1, 3, 60, 150]) {
    it(`${n} line(s): pages match the layout, every page has header + "Page X of Y", nothing lost or split`, async () => {
      const data = buildStatement({
        org: { name: branding.orgName },
        entity,
        period: october,
        currency: "USD",
        records: records(n),
        generatedAt: "",
      });
      const doc = monthlyStatement(data, { entitySingular: "Property" });
      const pages = await pagesOf(await renderPdf(renderReport(doc, branding, "Generated Nov 1, 2026")));

      expect(pages).toHaveLength(doc.pages.length);
      pages.forEach((text, i) => {
        expect(text).toContain("Harbor & Pine PM");
        expect(text).toContain("COST STATEMENT");
        expect(text).toMatch(new RegExp(`Page\\s*${i + 1}\\s*of\\s*${pages.length}`));
        expect(text).toContain("Harbor & Pine · 1 Main St");
        if (i < pages.length - 1 && n > 10) expect(text).toContain("Carried forward");
        if (i > 0) expect(text).toContain("Brought forward");
        if (i > 0) expect(text).toContain("SUPPLIER"); // the table header repeats
      });
      // Every invoice appears exactly once (no row lost or split across pages).
      const all = pages.join("\n");
      for (const r of data.lines) expect(all.split(r.invoiceNumber!).length - 1).toBe(1);
      // The grand total is printed on the last page, as lib/calc computed it.
      const total = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
        data.summary.gross / 100,
      );
      expect(pages.at(-1)).toContain(total);
      if (n === 150) expect(pages.length).toBeGreaterThanOrEqual(5);
    }, 60_000);
  }
});

describe("summary and quote PDFs", () => {
  it("portfolio summary of 50 entities spans pages with carried-forward totals", async () => {
    const recs = records(50).map((r, i) => ({ ...r, entityId: `e${i}` }));
    const entities = recs.map((r, i) => ({
      id: `e${i}`,
      name: `Unit ${i + 1}`,
      code: `U${i + 1}`,
      address: null,
      clientName: null,
    }));
    const data = buildPortfolio({
      org: { name: branding.orgName },
      entities,
      period: october,
      currency: "USD",
      records: recs,
    });
    const doc = portfolioSummary(data, { entityPlural: "Properties" });
    const pages = await pagesOf(await renderPdf(renderReport(doc, branding, "Generated")));
    expect(pages).toHaveLength(doc.pages.length);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0]).toContain("Carried forward");
    for (let i = 1; i <= 50; i++) expect(pages.join("\n")).toContain(`Unit ${i}`);
  }, 60_000);

  it("quote shows prices only, tax and total", async () => {
    const data = buildQuote({
      org: { name: branding.orgName },
      entity: { ...entity, clientName: "M. Chen" },
      period: october,
      currency: "USD",
      records: records(3),
      number: "Q-0042",
      issueDate: "2026-11-01",
      validUntil: "2026-12-01",
      markupBp: 2000,
      taxRateBp: 825,
      notes: "Work starts within 5 days of acceptance.",
      generatedAt: "",
    });
    const pages = await pagesOf(await renderPdf(renderReport(quote(data), branding, "Generated")));
    expect(pages).toHaveLength(1);
    const fmt = (c: number) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
    expect(pages[0]).toContain("Q-0042");
    expect(pages[0]).toContain("M. Chen");
    expect(pages[0]).toContain(fmt(data.total));
    expect(pages[0]).toMatch(/Tax\W*8\.25\W*%/); // unpdf drops some punctuation when extracting
    expect(pages[0]).toContain("Work starts within 5 days");
    expect(pages[0]).not.toContain(fmt(data.lines[0]!.cost)); // costs never printed
  }, 60_000);
});
