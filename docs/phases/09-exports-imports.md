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
