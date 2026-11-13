# Architecture Decision Records

Append new ADRs at the bottom. Never rewrite an accepted ADR — supersede it.

## ADR-001 — One product, two personas via `entity.kind`

**Status:** Accepted (2026-11-10)
Property managers and contractors are served equally. The core record is a generic `entity` with
`kind = property | job`; the org picks a mode at onboarding. All wording comes from `entityLabels(kind)`.
**Why:** one codebase covers property, bookkeeping, contractor and quote-engine use cases.

## ADR-002 — Next.js for request/response, separate Node worker for long jobs

**Status:** Accepted (2026-11-10)
No standalone Node API server. Server Actions + Route Handlers handle requests; a BullMQ worker (`worker/`) on
Railway/Fly handles OCR, AI, PDF rendering and ZIPs. Redis on Upstash.
**Why:** serverless time/memory limits make OCR + Chromium impractical on Vercel; BullMQ is the Node-native
equivalent of Celery. Shared domain code lives in `lib/`.

## ADR-003 — Provider-agnostic AI via the Vercel AI SDK

**Status:** Accepted (2026-11-10)
`lib/ai/provider.ts` maps `AI_PROVIDER` + `AI_MODEL` to an AI SDK model. Default: Anthropic `claude-sonnet-5-5`.
Structured output validated by zod. **Why:** swap providers/models without code changes; compare accuracy/cost.
_Default model superseded by ADR-018 (open model via OpenRouter); the provider-agnostic design stands._

## ADR-004 — Playwright (not WeasyPrint) for PDFs

**Status:** Accepted (2026-11-10)
**Why:** the stack is Node-only; Chromium's print engine handles repeated table headers, `break-inside`, and
header/footer templates with page numbers; the worker image already ships Chromium.

## ADR-005 — Money as integer cents; AI never calculates

**Status:** Accepted (2026-11-10)
AI returns amounts as printed strings; `parseToCents` converts deterministically. All math is in `lib/calc` with
tests. **Why:** correctness and auditability of financial statements.

## ADR-006 — Isolation in the database (RLS) with an auto-discovering test suite

**Status:** Accepted (2026-11-10)
**Why:** app-level filtering alone is one forgotten `where` away from a breach; auto-discovery means new tables
can't silently skip isolation tests.

## ADR-007 — Miro-inspired design with free fonts

**Status:** Accepted (2026-11-10)
Layout and patterns mirror miro.com; fonts are Noto Sans (body) and Plus Jakarta Sans (display, stand-in for
Roobert PRO). Ink `#050038` instead of pure black. No Miro assets or copy. **Why:** strong, familiar UX without
licensing or trademark issues.

## ADR-008 — shadcn `base-nova` style + `cn` package

**Status:** Accepted (2026-11-10)
The shadcn CLI initialized with Base UI primitives and the `cn` package (instead of clsx + tailwind-merge). Kept as
generated; our code imports `cn` from `@/lib/utils` so it can be swapped in one place.

## ADR-009 — Reduced motion for scroll reveals is enforced in CSS, not by swapping elements

**Status:** Accepted (2026-11-11)
`Reveal` and `Stagger`/`StaggerItem` always render the same Motion element on server and client and carry a
`data-reveal` attribute; a `prefers-reduced-motion: reduce` rule in `app/globals.css` forces those elements to
`opacity: 1; transform: none`. Other wrappers (FadeSwap, HoverLift, Float) rely on `MotionConfig
reducedMotion="user"` since they never server-render hidden. **Why:** the server cannot know the user's preference.
The previous approach (`useReducedMotion()` → render a plain `div`) hydrated over the server's inline
`opacity: 0`, which React does not patch, so reduced-motion users saw blank sections. The CSS rule also works
before JS loads. Corollary: above-the-fold LCP content (hero/pricing headlines) is never wrapped in `Reveal`.

## ADR-010 — Invites are shareable one-time links (no email delivery yet)

**Status:** Accepted (2026-11-11)
Inviting a teammate creates an `invites` row (sha256 of a 192-bit token, 7-day expiry, never the owner role) and
shows the `/invite/{token}` link to the inviter to share. Accepting requires signing in with the invited email
(`accept_invite()` checks the JWT email). **Why:** transactional email needs a provider decision (Resend/Postmark/
SES) and DNS setup that don't belong in the tenancy phase. Sending the same link by email is an additive change
(Phase 11 hardening or earlier if needed); the token, hashing and accept path stay as they are.

## ADR-011 — Org and membership creation only through security-definer RPCs

**Status:** Accepted (2026-11-11)
`organizations` and `memberships` have no INSERT policy; end users create them only via `create_organization()`
and `accept_invite()`. Ownership invariants (only owners grant/revoke owner; at least one owner) are enforced by
the `guard_membership_change` trigger rather than in Server Actions. **Why:** an INSERT policy on memberships
would have to be clever enough to stop "add myself as owner of org X"; with no policy at all that class of bug
can't exist, and the trigger keeps the invariants true for every client (UI, API, SQL), not just our actions.

## ADR-012 — Document status changes only through status-checked functions

**Status:** Accepted (2026-11-12)
Users can UPDATE only `documents.entity_id` and `file_name` (column grants). `uploading → queued` and
`failed → queued` go through `confirm_document_upload()` / `retry_document()`; the worker moves documents with
`transition_document(org, doc, from[], to)` (service role only), which updates only if the current status is in
`from` and sets `app.actor_id` so the audit log names the worker. **Why:** the status machine and attempt counter
stay consistent whatever the client does, and duplicate or late jobs can't move a document backwards — the
idempotency the queue design requires is enforced in one place.

## ADR-013 — OCR every sparse page; binarize with Otsu, no normalize/deskew

**Status:** Accepted (2026-11-13)
DOCUMENT_PIPELINE.md first said "OCR sparse pages only if > 50% of pages are sparse", which contradicts the Phase 4
acceptance criterion "mixed PDFs OCR only sparse pages" (a 1-in-4 scanned page would be skipped). Now every sparse
page is OCR'd and text-layer pages never are. Preprocessing was chosen by measurement on the fixtures: `normalize()`
stretched JPEG noise on mostly-white scans into stripes (0/7 key strings); Otsu binarization of plain grayscale
found 7/7 on every scanned page and 8/8 on the phone photo. Deskew is not applied: the fixtures are tilted ~1° and
Tesseract handles that; revisit with real customer scans. **Update (2026-11-14):** page segmentation is
`SINGLE_BLOCK` (PSM 6), not automatic layout — on a small receipt, automatic layout silently dropped the TOTAL line
while reporting _higher_ confidence (93 vs 87); PSM 6 kept every line on every fixture and reads table rows left to
right. Found by the extraction eval, now a slow-test regression case. Note Tesseract's own confidence can be high on garbage
(95 with 0/7 key strings), so OCR quality is tested on content, not confidence.

## ADR-014 — HEIC/HEIF decoded with libheif-in-WASM (`heic-decode`)

**Status:** Accepted (2026-11-13)
Prebuilt sharp/libvips ships without the HEVC decoder (patent licensing), so it reads AVIF but not iPhone HEIC.
`heic-decode` (libheif compiled to WASM) decodes to RGBA, which sharp then handles. No native build step or system
libheif needed in the worker image. No HEIC fixture yet (none can be produced here without an HEVC encoder): the
path is unit-tested with a mocked decoder — add a real iPhone photo fixture when one is available.

## ADR-015 — Extraction: no sampling params, two-layer schema, refusal fallbacks

**Status:** Accepted (2026-11-14)
DOCUMENT_PIPELINE.md asked for temperature 0. Current Anthropic models reject sampling parameters (`temperature`,
`top_p`, `top_k`), and they reject forced tool use, so we send neither: the AI SDK uses the provider's native
structured output and the schema constrains the answer. The model fills a plain-typed `ModelExtraction`; strict
rules (ISO dates, currency codes, confidence range) are enforced afterwards by `InvoiceExtraction`, with retries
that feed the validation errors back. **Why:** a schema with formats/ranges can be rejected by a provider's
structured-output mode, and validating ourselves gives one behavior across providers (ADR-003). Anthropic requests
opt into server-side refusal fallbacks (`fallbacks: "default"`) so a declined request is re-run on a suitable model
inside the same call; a refusal that survives the fallback fails the document with a clear message.

## ADR-016 — Deterministic dev model (`AI_PROVIDER=mock`)

**Status:** Accepted (2026-11-14)
Local development and E2E run the full pipeline without an API key using a regex-based model built on the AI SDK's
mock class. It never claims more than 0.6 confidence (so its output always goes to review) and `extractionModel()`
refuses it when `NODE_ENV=production`. It is not a quality baseline: accuracy is measured only with real models via
`npm run eval:extraction`.

## ADR-017 — OpenRouter as an additional AI provider

**Status:** Accepted (2026-11-14)
`AI_PROVIDER=openrouter` (+ `OPENROUTER_API_KEY`, `AI_MODEL` = an OpenRouter id such as
`anthropic/claude-sonnet-5.5`) via `@openrouter/ai-sdk-provider`. **Why:** one key reaches Anthropic and other models,
so the extraction eval can compare models without code changes (ADR-003). Anthropic-only request options (refusal
fallbacks, effort) are not sent through OpenRouter. Before using it on real customer documents, review OpenRouter's
data-handling terms (documents pass through a third party); the default for production remains a direct provider.

## ADR-018 — Default extraction model: open-weight NVIDIA Nemotron 3.5 Super via OpenRouter, zero retention

**Status:** Accepted (2026-11-14) — supersedes ADR-003's default model
`AI_PROVIDER` now defaults to `openrouter` and the model to `nvidia/nemotron-3.5-super-vl` (open weights, 12B active
/ 120B MoE). Every request is routed only to hosts that neither collect nor retain prompts
(`provider: { data_collection: "deny", zdr: true }`) and that honor structured output (`require_parameters`).
Each provider has its own default model (`DEFAULT_MODELS` in `lib/ai/provider.ts`); `AI_MODEL` overrides.
**Why:** on the labeled fixtures it met the bar (two full runs 9/9 plus 4/4 of a third, ending on credit, with the
final prompt) at ≈ $0.002 per document (≈ $0.15 / $0.47 per M tokens) versus ≈ $0.02 for Anthropic Sonnet 5.5, and an
open model keeps the option to self-host. The owner chose the open model after an eval comparison was offered.
**Trade-offs:** 5–30 s per document (it reasons; ~4K output tokens), occasional schema retries; results vary
between runs, so changes to the prompt or model must be judged on repeated eval runs. Anthropic Sonnet 5.5 was not
measured (no credit) — it remains one setting away (`AI_PROVIDER=anthropic` or `AI_MODEL=anthropic/claude-sonnet-5.5`).

## ADR-019 — Review rules: reasons, decided records, live validation

**Status:** Accepted (2026-11-12)
Decisions made while building Phase 6 that the docs didn't fix:

- **Approving a record that still has errors needs a reason** (reject always does). Warnings never block. Errors are
  the cases where the numbers are probably wrong (missing field, total mismatch, duplicate), so an override must be
  explained in the audit trail. A clean record approves with one keystroke.
- **Decided records are frozen until reopened.** Corrections to an approved/rejected record are refused; `reopen`
  (also audited) puts it back in the queue. Reports built later (Phase 7+) can rely on approved data not drifting.
- **One database function per review step** (`review_record`) instead of client-side table updates: role check,
  per-field `review_actions`, confidence reset, issue replacement and document status change happen in one
  transaction, and clients have no update grant on `records`.
- **Live validation runs in the browser with server-provided context; the server re-validates on save** and its
  result is stored. Duplicate candidates are loaded for the stored values only (a duplicate introduced by an edit
  surfaces on save).
- **Line items are replaced as a set** on correction and recorded as one `line_items` review action (before/after
  arrays), rather than per-cell actions.
- **Clean records stay in the queue unless auto-approve is on** (off by default, an org setting). "Approve N clean
  items" is the fast path; it re-checks in the database that each record has no unresolved issues.
- **Preview page highlight is a text search**, since fields aren't traced to page coordinates: the preview opens on
  the page that prints the first flagged value (amounts with or without thousands separators), else page 1.
- **Worker writes show as "DocuMax"** in history and the audit log (`SYSTEM_ACTOR_ID`, `lib/audit/actors.ts`).

## ADR-020 — Postings: how approved records become statement figures

**Status:** Accepted (2026-11-12)
Every figure on a statement, the entity page, exports and summaries comes from one function,
`postRecord()` (`lib/calc/postings.ts`), which turns an approved record into per-entity net / tax / gross amounts.
Choices:

- **Dating and inclusion:** a record belongs to the period of its `issue_date`; only `approved` records count;
  records without a total or issue date are left out (they can only be approved with a reason).
- **Currencies are never mixed:** a statement is in the org's `default_currency`; records in other currencies are
  listed separately (count + total per currency), not converted. Conversion would need rates and a policy.
- **Fixed-amount splits keep the remainder at home** (the record's entity) rather than requiring amounts to add up
  exactly — "$200 to Unit B, the rest stays" is the common case. Percent splits must total exactly 100%.
- **Tax follows the money:** split in proportion to gross shares (record-level) or net shares (line-level), with
  largest-remainder rounding, so Σ net = total − tax, Σ tax = tax and Σ gross = total for every record, to the cent
  (property-tested). When the lines don't add up to the subtotal, the difference becomes its own posting instead of
  being dropped.
- **Record- or line-level, not both**, per record — combining them has no unambiguous meaning for fixed amounts.
- **Credit notes** printed with positive amounts post as negatives (fixed split amounts are entered as printed and
  take the same sign).
- **Time zone** (`organizations.timezone`, default UTC) only decides what "this month" is; issue dates are calendar
  dates. The field is added to the organization settings page with branding (Phase 8); until then it is UTC.

## ADR-021 — PDF reports: pagination in code, templates in code, worker-only report storage

**Status:** Accepted (2026-11-12)

- **Deterministic pagination.** Chromium can repeat table headers, but it can't print carried-forward subtotals or
  guarantee where rows break. Every report block and table row therefore has a fixed height (mm), long text is
  truncated to one line, and `pdf/layout.ts` assigns rows to pages. Each page shows "Brought forward" / "Carried
  forward" from `lib/calc` running totals. Render tests compare the PDF's page count with the layout and check every
  row appears exactly once. Trade-off: descriptions are truncated rather than wrapped.
- **Templates are code** (`pdf/templates`); the `report_templates` table in the original data model was not created.
  Per-org look = branding on `organizations` (logo, brand colour, footer text). A table can come back when
  organizations need their own templates.
- **Quotes show prices only.** Each cost line (net of tax) is marked up by the same rate, rounded per line, so the
  printed lines add up to the subtotal; tax is applied to the subtotal. Numbers are `Q-YYYY-NNNN`, per org and year,
  assigned in the database.
- **Only the worker writes the `reports` bucket**; branding is owners/admins only. A generated PDF can't be replaced
  through the API by a user.
- **ZIPs with `fflate`** (stored, not deflated: PDFs are already compressed) instead of `archiver` — in-memory,
  dependency-free, and readable in tests.
- **Batches finish exactly once:** each finished report recounts its batch in `report_batch_progress()` under a row
  lock; the call that completes the batch enqueues `batch-zip`.
- **No in-app preview route:** Next refuses `react-dom/server` in the app bundle, so template work uses
  `npm run pdf:preview` (HTML + real PDF from fixtures).

## ADR-022 — Exports and CSV imports

**Status:** Accepted (2026-11-12)

- **One CSV row = one record.** Line items are exported (own CSV / XLSX sheet) but not imported; spreadsheets of
  bills rarely carry them reliably. Imported records count 100% to their entity like any unsplit record.
- **Strict, explainable parsing:** dates must be ISO (`03/04/2026` is ambiguous between US and EU order); amounts
  go through `parseToCents` (no floats); categories and document types accept the code or the label; a property or
  job is matched by reference code, then exact name — a value that matches nothing is an error, not silently
  dropped. Any problem keeps the whole row out (never a partial record) and is listed in the error report.
- **Imported records are reviewed like extracted ones** (same `lib/validation`, same queue, audit actor = importer).
  "Approve on import" (reviewers only) approves only records without issues.
- **Formula injection:** CSV text cells starting with `= + - @`, tab or CR get a leading apostrophe; numeric
  columns are never escaped (a negative amount must stay a number) and the import strips the apostrophe again, so
  exports round-trip. XLSX writes strings as text, never formulas.
- **Plain, re-importable CSV:** money as `1260.57`, ISO dates, labels for enums, a UTF-8 BOM for Excel (stripped on
  import). Export headers are the import's default names, so an exported file maps itself.
- **Limits:** imports ≤ 5 MB / 5,000 rows (split larger files); exports are built in memory and capped at 20,000
  records per file — streaming can come later if needed. The last column mapping is stored on the organization
  (`organizations.import_mapping`) rather than in a separate table.

## ADR-023 — Billing: Stripe owns the subscription, Postgres enforces the limits

**Status:** Accepted (2026-11-12)

- **The plan changes only through the signed webhook.** Checkout and the portal are Stripe-hosted; our actions only
  create sessions. `subscriptions` mirrors Stripe (idempotent per event id, older events ignored), and
  `org_plan()` treats `active`, `trialing` and `past_due` as paid — Stripe's retries decide when a failed payment
  ends the plan; a deleted subscription means Free. Downgrades and cancellations are configured in the Stripe
  portal to apply at period end, so the plan simply follows Stripe's current price.
- **Caps live in two places on purpose:** `lib/billing/plans.ts` (UI, pricing page) and `plan_limits` (enforcement
  inside the database, where it can be atomic). A test fails if they drift.
- **Quota is taken when an upload starts,** atomically with the pending document (`create_document_upload`), and
  given back if the browser never finishes the upload. Processed documents count even if extraction fails later.
  Months follow the org's time zone.
- **Seats = members + open invites;** the limit is checked when an invite is created (a database trigger), so an
  accepted invite never needs a second check.
- **Releasing quota is not a user operation** (only `cancel_document_upload` and the service role can), otherwise
  a member could reset the counter.
- **Without Stripe configuration** the app runs on Free and billing actions say so; real billing needs
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, the four `STRIPE_PRICE_*` ids and a webhook endpoint for
  `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed` and `invoice.paid`.
- Test orgs in the integration suite are created on Business (`createOrg(…, { plan })` opts into Free), so caps
  only matter in the tests about them.

## ADR-024 — Production hardening choices

**Status:** Accepted (2026-11-12)

- **CSP with `'unsafe-inline'` scripts** (`lib/security/headers.ts`): Next's inline bootstrap scripts would need
  per-request nonces, which disables static optimisation of marketing pages. Everything else is locked to this
  origin plus the Supabase project; `frame-ancestors 'none'`, `object-src 'none'`, HSTS in production. Revisit with
  nonces if third-party scripts are ever added.
- **Rate limiting on our own Redis** instead of Upstash Ratelimit's REST client: the same Redis serves BullMQ
  (Upstash in production), so no second client or vendor API is needed. Fixed windows; auth limited per hashed IP,
  everything else per user; fails open if Redis is down (the database still enforces quotas and roles).
- **Errors: Sentry, opt-in by DSN**, with PII scrubbed in `beforeSend` and no performance tracing. Logs stay
  JSON lines from a tiny logger rather than pino — the platforms collect stdout, and the logger never receives
  document text.
- **Dependency audit in CI with `audit-ci`** (production deps, high+critical). Allowlisted, with reasons: the four
  postcss advisories inside `next@15.5.x` (build-time processing of our own CSS; fixed in Next 16). Upgrading to
  Next 16 removes the allowlist.
- **Deployment:** web via Vercel's Git integration; database migrations and the worker image (GHCR) via
  `.github/workflows/deploy.yml`, each step skipped until its secrets exist.
- **Organization deletion** purges storage with the owner's own client (RLS-checked), then deletes the
  organization row; database cascades remove everything else. User-account deletion stays an operator task.
- **Legal pages are drafts** written from how the product works; they show a "pending legal review" notice until
  reviewed.
- **Security review fixes** (`20261121090000_security_fixes.sql`): direct `documents` inserts revoked (uploads must
  go through `create_document_upload`, which counts quota); invite updates limited to `role`, seat trigger also on
  updates that reopen an invite, and `accept_invite` re-checks seats; `safeNext` resolves the target like a browser
  and accepts it only on our origin (control characters and backslashes are rejected).
