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
DOCUMENT_PIPELINE.md asked for temperature 0. Current Claude models reject sampling parameters (`temperature`,
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
`anthropic/claude-sonnet-5.5`) via `@openrouter/ai-sdk-provider`. **Why:** one key reaches Claude and other models,
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
final prompt) at ≈ $0.002 per document (≈ $0.15 / $0.47 per M tokens) versus ≈ $0.02 for Claude Sonnet 5.5, and an
open model keeps the option to self-host. The owner chose the open model after an eval comparison was offered.
**Trade-offs:** 5–30 s per document (it reasons; ~4K output tokens), occasional schema retries; results vary
between runs, so changes to the prompt or model must be judged on repeated eval runs. Claude Sonnet 5.5 was not
measured (no credit) — it remains one setting away (`AI_PROVIDER=anthropic` or `AI_MODEL=anthropic/claude-sonnet-5.5`).
