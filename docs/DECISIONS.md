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
