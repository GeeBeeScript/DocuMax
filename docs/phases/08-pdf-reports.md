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

## Completion evidence (2026-11-12)

- [x] **A statement with 150 lines spans pages with repeated headers, no split rows, correct page numbers** —
      `pdf/render.slow.test.ts` renders 1/3/60/150-line statements in Chromium and checks on every page: the header
      (org + report title), the repeated table header, "Page X of Y", brought / carried forward, and that every
      invoice appears exactly once; the PDF's page count equals the layout's.
- [x] **Logo, header and footer on every page; figures match `lib/calc` exactly** — header/footer are Chromium
      templates (logo as a data URI, brand colour bar, footer text, generation date); templates print only
      view-model figures (golden file + render tests assert the totals text). Worker integration test checks the
      HTML/header/footer for one org's branding.
- [x] **Batch of 50 entities → ZIP with 50 correctly named PDFs** — `tests/integration/worker/render-report.test.ts`
      (fake renderer, real database + Storage): 50 units + 1 job → 51 reports → `batch-zip` enqueued exactly once →
      ZIP entries equal `statementFileName()` for each entity. E2E downloads a real batch ZIP.
- [x] `reports` + `report_batches` (RLS, isolation suite, audited); worker-only `reports` bucket; org branding settings
      (logo upload, brand colour, footer text, time zone); generate statement / quote (entity page), summary and
      batch (reports page); live progress; signed-URL downloads.
- [x] Tests: `npm run check` (unit + component), integration (incl. storage rules per bucket, report actions,
      render/zip jobs, org settings), slow render tests, E2E 16 incl. "generate a statement, a quote and a batch, and
      download them".
- [x] Deviations recorded in ADR-021: no `report_templates` table (templates are code + branding); `fflate`
      instead of `archiver`; template preview is `npm run pdf:preview` instead of a dev route.
