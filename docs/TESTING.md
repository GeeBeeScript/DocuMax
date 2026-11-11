# Testing

| Layer       | Tool                     | Location                                  | Command                    |
| ----------- | ------------------------ | ----------------------------------------- | -------------------------- |
| Unit        | Vitest (+ jsdom, RTL)    | next to source: `*.test.ts(x)`            | `npm test`                 |
| Integration | Vitest (node env)        | `tests/integration/**`                    | `npm run test:integration` |
| E2E         | Playwright               | `tests/e2e/**`                            | `npm run e2e`              |
| Fixtures    | Sample invoices/receipts | `tests/fixtures/{pdf,scanned,images,csv}` | —                          |

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

## Running integration and E2E tests locally

Both need local Supabase: `npx supabase start`, then put the URL, anon key and service-role key from
`npx supabase status` into `.env.local` (plus `SUPABASE_DB_URL`, default
`postgresql://postgres:postgres@127.0.0.1:54322/postgres`). After changing migrations: `npm run db:reset` and
`npm run db:types`.

- Integration tests create their own users/orgs with random emails and delete them afterwards; files run one at a
  time (`fileParallelism: false`).
- The isolation suite was verified to fail when a permissive policy or un-forced RLS is planted — keep it that way
  when changing it (plant a leak, see red, remove it).
- E2E also needs Redis (`docker compose up -d redis`); Playwright starts the worker itself with fast stub steps
  (`STUB_STEP_MS=150`). Fixtures: `tests/fixtures/pdf/sample-invoice-3-pages.pdf`, `tests/fixtures/images/sample-receipt.png`.
- Server Actions are tested as real users via `tests/integration/next-mocks.ts` (`actAs(user)`); `enqueue()` is
  recorded (and zod-validated) instead of hitting Redis — assert on `enqueued()`.
- If `supabase start` cannot pull from `public.ecr.aws` (restricted networks), set
  `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io` to pull the same images from Docker Hub.
