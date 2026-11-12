# Phase 9 — Exports & imports

**Goal:** get data out (CSV/Excel) and bring existing records in (CSV) safely.

## Scope

- Deps: `papaparse`, `exceljs`.
- `lib/export/*`: column definitions shared by CSV and XLSX (records, line items, statement data); XLSX with
  formatted header, frozen first row, currency number formats (values in units from cents), one sheet per dataset.
- Route Handlers stream exports respecting current filters and RLS.
- CSV import: upload → column mapping UI (auto-suggest by header names, saved per org) → zod row validation →
  preview (first 50 rows, error count) → `import-csv` job inserts records (status `needs_review` or `approved` per
  option) and runs the same `lib/validation` → error report CSV downloadable.
- Migration: `imports`. Downloadable CSV template.

## Acceptance criteria

- Export → re-import round-trips records without data loss.
- Invalid rows never insert; the error report lists row number, column and message.
- Imported records appear in review and audit logs like extracted ones.

## Tests

- Unit: column mapping, row schema, number/date parsing edge cases, formula-injection escaping (`=`, `+`, `-`, `@`).
- Integration: import job end-to-end with fixture CSVs; round-trip test.

## Completion evidence (2026-11-12)

- [x] **Export → re-import round-trips records without data loss** — `tests/integration/worker/import-csv.test.ts`
      exports a credit note (negative amounts, formula-looking supplier and invoice number, tax rate, EUR, category,
      property) with the same code the export route uses and re-imports it into another org: every field equal.
- [x] **Invalid rows never insert; the error report lists row number, column and message** — integration test
      (5-row CSV → 3 records, report with spreadsheet row numbers and the CSV's own header names) and E2E.
- [x] **Imported records appear in review and audit logs like extracted ones** — validation issues stored
      (duplicate within the file, no entity), status `needs_review`, `audit_log` insert actor = the importer;
      approve-on-import (reviewers) writes an `approve` review action.
- [x] Exports: records / line items as CSV, records + line items as XLSX (bold frozen header, money and date formats),
      statement data per entity and period (CSV, or XLSX with summary, totals, categories, costs) — RLS via the user's
      client; downloadable CSV template.
- [x] Tests: unit (mapping, row parsing edge cases, CSV parsing, formula escaping both ways, XLSX output), component
      (wizard, history, export form), integration (import job, round trip, isolation suite incl. `imports`, storage
      rules), E2E "import records from CSV, see them in review, export them again".
- [x] Decisions in ADR-022.
