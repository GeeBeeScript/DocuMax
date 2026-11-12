# Phase 8 — PDF reports

**Goal:** polished, branded multi-page statements, summaries and quotes, single or in batches with ZIP download.

## Scope

- `pdf/components`: `BrandBar`, `ReportHeader`, `ReportTable` (repeating `thead`, no split rows, carried-forward
  subtotals), `TotalsBlock`, `PageFooter`; `pdf/styles/print.css` (A4, margins, print-safe tokens).
- `pdf/templates`: `MonthlyStatement`, `PortfolioSummary`, `Quote` — fed by `lib/calc/statement.ts` view-models.
- `worker/pdf/render.ts`: one shared Chromium per worker, `renderToStaticMarkup` → `page.setContent` →
  `page.pdf({ displayHeaderFooter, headerTemplate (logo + org name), footerTemplate (Page X of Y) })`.
- Migrations: `report_templates` (system + org), `reports`, `report_batches`.
- Org branding settings: logo upload (`branding` bucket), brand color, footer text; plus the org time zone (ADR-020).
- UI: "Generate statement" (entity + period), batch generate (all entities for a period) with progress, reports
  list with download (signed URL), batch ZIP download (`archiver` in `batch-zip` job).
- Dev preview route `/app/dev/report-preview` rendering templates as HTML for fast iteration (dev only).

## Acceptance criteria

- A statement with 150 lines spans pages with repeated headers, no split rows, correct page numbers.
- Logo, header and footer appear on every page; figures match `lib/calc` exactly.
- Batch of 50 entities produces a ZIP with 50 correctly named PDFs.

## Tests

- Render tests with 1/3/60/150-line fixtures: page count, header/footer text per page, totals text (`pdf-parse`).
- Batch job test with mocked renderer; ZIP contents check.
