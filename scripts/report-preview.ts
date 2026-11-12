/**
 * DEV: render a PDF template with fixture data, without the app or the queue.
 *   npm run pdf:preview -- statement 60      → .preview/statement-60.html + .pdf
 *   npm run pdf:preview -- summary | quote
 * Open the HTML for fast CSS iteration (pages outlined); the PDF is the real Chromium output (header, footer,
 * page numbers). Set CHROMIUM_PATH if the Playwright browser isn't installed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { entities, records } from "@/lib/calc/__fixtures__/statement-records";
import { monthPeriod } from "@/lib/calc/period";
import { buildQuote } from "@/lib/calc/quote";
import { buildPortfolio, buildStatement, type StatementRecord } from "@/lib/calc/statement";
import { renderReport } from "@/pdf/document";
import { monthlyStatement } from "@/pdf/templates/monthly-statement";
import { portfolioSummary } from "@/pdf/templates/portfolio-summary";
import { quote } from "@/pdf/templates/quote";
import { closeBrowser, renderPdf } from "@/worker/pdf/render";

const template = process.argv[2] ?? "statement";
const lines = Math.min(Math.max(Number(process.argv[3] ?? 3) || 3, 0), 1000);
const period = monthPeriod("2026-10");
const extra: StatementRecord[] = Array.from({ length: Math.max(lines - 3, 0) }, (_, i) => ({
  ...records[0]!,
  id: `extra-${i}`,
  invoiceNumber: `INV-${1000 + i}`,
  supplierName: `Supplier ${i % 9}`,
  lines: [],
  totalCents: 5_000 + i * 113,
  taxCents: 0,
}));
const all = [...records, ...extra];
const org = { name: "Harbor & Pine Property Management" };

const doc =
  template === "summary"
    ? portfolioSummary(buildPortfolio({ org, entities, period, currency: "USD", records: all }), {
        entityPlural: "Properties",
      })
    : template === "quote"
      ? quote(
          buildQuote({
            org,
            entity: entities[0]!,
            period,
            currency: "USD",
            records: all,
            number: "Q-2026-0001",
            issueDate: "2026-11-01",
            validUntil: "2026-12-01",
            markupBp: 1500,
            taxRateBp: 825,
            notes: "Work starts within 5 days of acceptance.",
            generatedAt: "",
          }),
        )
      : monthlyStatement(
          buildStatement({
            org,
            entity: entities[0]!,
            period,
            currency: "USD",
            records: all,
            generatedAt: "",
          }),
          { entitySingular: "Property" },
        );

const rendered = renderReport(
  doc,
  { orgName: org.name, logoDataUri: null, brandColor: "#ffd02f", footerText: "1 Main St · Springfield" },
  "Generated Nov 1, 2026",
);
const outDir = path.join(process.cwd(), ".preview");
mkdirSync(outDir, { recursive: true });
const base = path.join(outDir, `${template}-${lines}`);
writeFileSync(
  `${base}.html`,
  rendered.html.replace(
    "<body>",
    '<body style="background:#e9e9ef;padding:24px"><style>.page{background:#fff;width:178mm;margin:0 auto 12mm;outline:1px solid #ccc}</style>',
  ),
);

void (async () => {
  writeFileSync(`${base}.pdf`, await renderPdf(rendered));
  await closeBrowser();
  console.log(`${base}.html\n${base}.pdf (${doc.pages.length} page(s))`);
})();
