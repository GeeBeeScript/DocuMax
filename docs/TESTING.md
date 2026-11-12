# Testing

| Layer       | Tool                     | Location                                  | Command                    |
| ----------- | ------------------------ | ----------------------------------------- | -------------------------- |
| Unit        | Vitest (+ jsdom, RTL)    | next to source: `*.test.ts(x)`            | `npm test`                 |
| Integration | Vitest (node env)        | `tests/integration/**`                    | `npm run test:integration` |
| E2E         | Playwright               | `tests/e2e/**`                            | `npm run e2e`              |
| Fixtures    | Sample invoices/receipts | `tests/fixtures/{pdf,scanned,images,csv}` | —                          |

## What must be tested

| Area               | Required                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/calc/*`       | Exhaustive unit tests incl. rounding, negatives (credit notes), zero, large values, property-based tests for allocation sums (`fast-check`)                                                                                                                                                                                                                                                                         |
| `lib/validation/*` | One test per rule, positive + negative + tolerance edges                                                                                                                                                                                                                                                                                                                                                            |
| `lib/ai/*`         | Schema parsing of recorded model outputs (fixtures); no live API calls in CI                                                                                                                                                                                                                                                                                                                                        |
| `lib/pipeline/*`   | Text-layer vs OCR routing using fixtures; OCR tests in `*.slow.test.ts` (`npm run test:slow`)                                                                                                                                                                                                                                                                                                                       |
| Tenancy            | Full isolation suite (see [MULTI_TENANCY.md](MULTI_TENANCY.md)) — **must pass for every merge** from Phase 2 on                                                                                                                                                                                                                                                                                                     |
| Components         | Render test per brand/marketing/app component; behavior tests for interactive ones                                                                                                                                                                                                                                                                                                                                  |
| Server Actions     | Integration tests for role checks and audit entries                                                                                                                                                                                                                                                                                                                                                                 |
| Exports/imports    | `lib/export` (CSV formula escaping on text only, XLSX formats), `lib/import` (mapping, row parsing edge cases, CSV parsing); integration: import job end-to-end (error report, review issues, audit actor, approve on import) and **export → import round trip** (`tests/integration/worker/import-csv.test.ts`); E2E import → review → export                                                                      |
| PDFs (Phase 8)     | `pdf/layout.test.ts` (pagination invariants); `pdf/render.slow.test.ts` — real Chromium, 1/3/60/150-line statements, 50-entity summary, quote: page count = layout, header/footer + "Page X of Y" on every page, carried/brought forward, every row exactly once (`npm run test:slow`, needs Chromium — `CHROMIUM_PATH`); worker integration with a fake renderer incl. a 50-PDF batch ZIP; E2E generate → download |
| Statements (Ph. 7) | `lib/calc` allocate / postings / statement: fast-check invariants (always reconcile), golden file `lib/calc/__golden__/statement-elm-2026-10.json` (update with `npx vitest -u` only when a change is intended); allocation actions + statement loader (integration); E2E split → entity figures                                                                                                                    |
| Review (Phase 6)   | Draft parsing/diff + queue order/filters + shortcut mapping (unit); review form, banners, shortcuts (component); review actions incl. reasons, reopen, bulk approve, cross-org (integration); E2E review → correct → approve                                                                                                                                                                                        |
| PDF                | Render fixture statements with 1, 3 and 60 line items; assert page count, header/footer text, no split rows (via `pdf-parse` text positions)                                                                                                                                                                                                                                                                        |
| Exports/imports    | Round-trip: export → import → equal records                                                                                                                                                                                                                                                                                                                                                                         |
| Billing            | Webhook handler with Stripe fixture events; quota function concurrency test; direct `documents` inserts and invite rewrites are refused (quota/seat bypass)                                                                                                                                                                                                                                                         |
| E2E (Phase 11)     | Sign up → create org → upload → review → approve → generate statement → download, then a viewer's read-only view (`tests/e2e/happy-path.spec.ts`); CI runs every suite (`.github/workflows/ci.yml`)                                                                                                                                                                                                                 |

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

## Pipeline fixtures

`tests/fixtures/generate.mjs` (+ `encrypt.py` for the password-protected PDF) regenerates every fixture from
synthetic content: digital, scanned 3-page, mixed, phone photo (sideways, EXIF orientation 6), corrupt and
password-protected PDFs. `PW_CHROMIUM=/path/to/chrome` points it at a preinstalled browser. Slow OCR tests assert
key strings per fixture and the < 30 s budget for the 3-page scan.

## AI extraction

- CI never calls a model: unit tests use recorded outputs (`tests/fixtures/ai/*.json`) through
  `tests/support/mock-ai.ts` (`replayModel`), covering valid, partially-null, invalid-field and malformed outputs,
  the retry path, refusals and transport errors.
- E2E runs the worker with `AI_PROVIDER=mock` (deterministic dev model).
- Accuracy: `npm run eval:extraction` (real provider; manual / nightly; ≈ $0.02 per run on the default model).
  Results vary between runs: judge a prompt or model change on at least two full runs. Other models:
  `AI_MODEL=anthropic/claude-sonnet-5.5 npm run eval:extraction`; free `:free` models need `OPENROUTER_ZDR=false`
  (synthetic fixtures only). In Claude Code cloud
  sessions the key is a proxy-injected network secret: set `OPENROUTER_API_KEY=proxy-injected` and
  `NODE_USE_ENV_PROXY=1` (Node's fetch ignores `HTTPS_PROXY` otherwise). Add a fixture by generating the document
  in `tests/fixtures/generate.mjs` and its expected required fields in `tests/fixtures/labels/extraction.json`.
