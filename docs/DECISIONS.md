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
