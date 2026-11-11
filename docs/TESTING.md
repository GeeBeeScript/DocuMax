# Testing

| Layer       | Tool                     | Location                                  | Command                              |
| ----------- | ------------------------ | ----------------------------------------- | ------------------------------------ |
| Unit        | Vitest (+ jsdom, RTL)    | next to source: `*.test.ts(x)`            | `npm test`                           |
| Integration | Vitest (node env)        | `tests/integration/**`                    | `npm run test:integration` (Phase 2) |
| E2E         | Playwright               | `tests/e2e/**`                            | `npm run e2e`                        |
| Fixtures    | Sample invoices/receipts | `tests/fixtures/{pdf,scanned,images,csv}` | —                                    |

## What must be tested

| Area               | Required                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/calc/*`       | Exhaustive unit tests incl. rounding, negatives (credit notes), zero, large values, property-based tests for allocation sums (`fast-check`)  |
| `lib/validation/*` | One test per rule, positive + negative + tolerance edges                                                                                     |
| `lib/ai/*`         | Schema parsing of recorded model outputs (fixtures); no live API calls in CI                                                                 |
| `lib/pipeline/*`   | Text-layer vs OCR routing using fixtures; OCR test marked slow                                                                               |
| Tenancy            | Full isolation suite (see [MULTI_TENANCY.md](MULTI_TENANCY.md)) — **must pass for every merge** from Phase 2 on                              |
| Components         | Render test per brand/marketing/app component; behavior tests for interactive ones                                                           |
| Server Actions     | Integration tests for role checks and audit entries                                                                                          |
| PDF                | Render fixture statements with 1, 3 and 60 line items; assert page count, header/footer text, no split rows (via `pdf-parse` text positions) |
| Exports/imports    | Round-trip: export → import → equal records                                                                                                  |
| Billing            | Webhook handler with Stripe fixture events; quota function concurrency test                                                                  |
| E2E (Phase 11)     | Sign up → create org → upload → review → approve → generate statement → download                                                             |

## Principles

- No network in unit tests. AI calls are mocked at `extractionModel()`; record real responses as fixtures.
- Integration tests use local Supabase and create isolated orgs per test file; clean up after.
- Tests describe behavior, not implementation. Prefer `getByRole` queries.
- jsdom polyfills (e.g. `IntersectionObserver`) live in `tests/setup/vitest.setup.ts`.
