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
