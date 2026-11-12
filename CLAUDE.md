# DocuMax — Agent & Contributor Guide

DocuMax is a multi-tenant SaaS that turns messy supplier invoices and receipts into checked, structured data
(AI extraction → validation → human review) and produces polished multi-page PDF cost statements and quotes per
**entity** (a property _or_ a job) per period. Audiences: property managers **and** home-service contractors, equally.

**Read before working:** [docs/ROADMAP.md](docs/ROADMAP.md) → the current phase file in [docs/phases/](docs/phases/) → the
docs it links. Never start a phase without reading its file; never mark it done without meeting its Definition of Done.

## Stack

Next.js 15 (App Router, RSC) · TypeScript strict · Tailwind v4 · shadcn/ui (Base UI flavour) · Motion (`motion/react`)
· Supabase (Postgres + Auth + Storage + Realtime) · BullMQ + Redis worker (`worker/`) · Vercel AI SDK (provider-agnostic)
· Playwright (PDF rendering + e2e) · Vitest · zod v4 · Stripe.

## Commands

| Task                  | Command                                                            |
| --------------------- | ------------------------------------------------------------------ |
| Web dev server        | `npm run dev`                                                      |
| Worker (watch)        | `npm run worker:dev` (needs Redis: `docker compose up -d redis`)   |
| Queue round-trip test | `npm run queue:ping`                                               |
| Local Supabase        | `npx supabase start` / `npx supabase status`                       |
| All checks            | `npm run check` (lint + typecheck + unit tests)                    |
| Integration tests     | `npm run test:integration` (needs local Supabase running)          |
| DB reset / types      | `npm run db:reset` / `npm run db:types`                            |
| Unit tests            | `npm test`                                                         |
| Slow OCR tests        | `npm run test:slow` (real Tesseract on fixtures)                   |
| Extraction eval       | `npm run eval:extraction` (real AI calls — costs money; ≥ 90% bar) |
| E2E                   | `npm run e2e`                                                      |
| Format                | `npm run format`                                                   |

## Folder map

```
app/                  Routes only — thin: fetch data, compose components
components/ui/        shadcn primitives (generated; restyle via tokens, no business logic)
components/brand/     DocuMax primitives: PillButton, StickyNote, BoardCanvas, YellowMarker, Logo, SectionHeading
components/motion/    Motion wrappers: Reveal (+ Stagger, HoverLift, FadeSwap as added)
components/marketing/ Landing/pricing section blocks
components/app/       App shell + shared app pieces (DataTable, StatusBadge, FileDropzone…)
features/<domain>/    Domain feature modules: components/, actions.ts, queries.ts, schema.ts
content/              Typed copy/config objects (all marketing text lives here)
lib/                  Framework-agnostic domain code shared by web + worker
  calc/               Money + totals + allocations (pure, unit-tested) — the ONLY place math happens
  queue/              Queue names, zod job payloads, enqueue()
  supabase/           server / client / admin clients
  ai/                 Provider selection + extraction schema
  entities/           entityLabels(kind) — property vs job wording
pdf/                  HTML report templates + components (rendered by Playwright in the worker)
worker/               BullMQ worker process (runs outside Next.js)
supabase/             Migrations, seed, config
tests/                setup/, fixtures/, integration/, e2e/
docs/                 Product, architecture and phase docs
```

## Non-negotiables

1. **Tenant isolation.** Every tenant table has `org_id uuid not null` + RLS enabled + policies using
   `is_org_member()` / `has_org_role()`. Every new tenant table is covered by the isolation suite (automatic — see
   [docs/MULTI_TENANCY.md](docs/MULTI_TENANCY.md)). Storage paths start with `{org_id}/`. The service-role client
   (`lib/supabase/admin.ts`) is only for the worker, webhooks and tests, and every query with it filters by `org_id`.
2. **Money is integer cents.** Use `lib/calc/money.ts`. No floats, no `toFixed` math.
3. **The AI never calculates.** AI fills the extraction schema only. Totals, tax checks, allocations and statement
   figures are computed in `lib/calc/` with unit tests.
4. **Validate every boundary with zod**: env, form input, Server Action args, job payloads, AI output, CSV rows,
   webhook bodies.
5. **Every mutation of business data is audited** (DB trigger → `audit_log`; review actions also record a reason).
6. **Componentize.** Pages compose components; no copy-pasted markup patterns; copy lives in `content/`; variants via
   `cva`; entity wording via `entityLabels()`. See [docs/CONVENTIONS.md](docs/CONVENTIONS.md).
7. **Follow the design system** ([docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)). Use tokens, never raw hex. Miro is the
   reference for layout/patterns — never copy Miro's logo, illustrations, screenshots or copy.
8. **Tests are part of done.** Each phase's DoD lists required tests. `npm run check` must pass.
9. **Server Components by default.** `"use client"` only on interactive leaves.
10. **Record decisions.** Any architectural choice that deviates from these docs → add an ADR to
    [docs/DECISIONS.md](docs/DECISIONS.md) and update the affected doc in the same change.

## Docs index

- [docs/PRD.md](docs/PRD.md) — product requirements, personas, user stories
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, pipeline, deployment
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — tables, relationships, status machines
- [docs/MULTI_TENANCY.md](docs/MULTI_TENANCY.md) — RLS, roles, storage, isolation tests
- [docs/DOCUMENT_PIPELINE.md](docs/DOCUMENT_PIPELINE.md) — extraction, OCR, AI schema, validation, review routing
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — tokens, type, components, Miro page mapping
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — code structure, componentization, naming, patterns
- [docs/TESTING.md](docs/TESTING.md) — test strategy and required coverage
- [docs/ROADMAP.md](docs/ROADMAP.md) — phases and status
- [docs/DECISIONS.md](docs/DECISIONS.md) — architecture decision records

## Gotchas

- shadcn generated files import `cn` from the `cn` package; our code imports `cn` from `@/lib/utils`.
- shadcn style is `base-nova` (Base UI primitives, not Radix): composition uses the `render` prop, not `asChild`.
- Tailwind v4: tokens live in `app/globals.css` `@theme`; there is no `tailwind.config`.
- zod is v4 (`z.url()`, `z.uuid()`, `z.iso.datetime()`).
- The worker loads `.env.local` then `.env` (`worker/load-env.ts`); Next loads them itself.
- Supabase Realtime in the browser: `await supabase.realtime.setAuth(token)` before subscribing, or RLS hides every event.
- Values passed from a Server Component to a Client Component must be serializable — no functions or icon
  components in props (copy objects with functions are read inside the client component instead).
- When implementing AI calls (Phase 5), load the `claude-api` skill for current model IDs and structured-output usage.
