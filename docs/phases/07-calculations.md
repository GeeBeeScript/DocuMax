# Phase 7 — Calculations & allocations

**Goal:** correct, tested figures for statements — totals per entity and period, and splits across entities.

## Scope

- `lib/calc/allocate.ts`: split an amount by percentages (basis points) or fixed amounts using largest-remainder
  rounding; always sums exactly to the source; validates inputs (percent total = 100%, amounts ≤ source).
- `lib/calc/totals.ts`: aggregate approved records/line items (after allocations) by entity, period (month or
  custom range), category, supplier; tax totals; credit notes as negatives.
- `lib/calc/period.ts`: period boundaries (timezone-aware via org timezone), month iteration.
- `lib/calc/statement.ts`: builds the `StatementData` view-model used by PDF templates and exports (opening
  summary, category breakdown, line table, totals). No formatting logic in templates beyond display.
- Migration: `allocations`. UI: allocation editor on the record screen (split by % or amount across entities).
- Entity detail page: period picker, totals by category, record list — figures from `lib/calc`.

## Acceptance criteria

- Allocations always reconcile to the cent; unallocated records count 100% to their entity.
- Statement totals equal the sum of their lines; portfolio total equals the sum of entity totals.
- Only `approved` records are included.

## Tests

- Exhaustive unit tests + property-based tests (`fast-check`) for allocate/totals invariants.
- Golden-file tests for `buildStatement` with fixture data.

## Completion evidence (2026-11-12)

- [x] **Allocations always reconcile to the cent** — `allocate.test.ts` and `postings.test.ts` (fast-check: any
      total, tax, lines, percent / amount / line-level split → Σ net, tax and gross equal the record's figures);
      unallocated records post 100% to their entity (unit + integration).
- [x] **Statement totals equal the sum of their lines; portfolio total equals the sum of entity totals** —
      `statement.test.ts` (golden file + property test: Σ entity statements + unassigned = portfolio total) and the
      integration test that builds two entities' statements from the database.
- [x] **Only approved records are included** — fixture includes a pending, an out-of-period and a foreign-currency
      record (excluded / reported separately); loader filters `status = approved` in the query too.
- [x] `allocations` table (RLS, isolation suite, audited) + `set_allocations()`; allocation editor on the review
      screen (percent or amount, exact preview); entity page with period picker (month, custom range), totals,
      category breakdown, top suppliers and the cost list — all figures from `lib/calc`.
- [x] Tests: unit + component 400 (`npm run check`), integration 302 incl. allocation actions, E2E 15 incl. "approve a
      cost, split it across two properties, and see each property's figures" ($756.34 + $504.23 = $1,260.57).
- [x] Decisions in ADR-020. Follow-up: org time zone field on the settings page (Phase 8).
