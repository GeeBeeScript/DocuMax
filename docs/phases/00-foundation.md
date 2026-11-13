# Phase 0 — Foundation & governance ✅

**Goal:** a working skeleton every later phase builds on, plus the docs that keep quality consistent.

## Deliverables

- [x] Governance docs: `AGENTS.md`, `docs/*` (PRD, ARCHITECTURE, DATA_MODEL, MULTI_TENANCY, DOCUMENT_PIPELINE,
      DESIGN_SYSTEM, CONVENTIONS, TESTING, ROADMAP, DECISIONS) and all phase files.
- [x] Dependencies: motion, zod v4, Supabase (`supabase-js`, `ssr`), BullMQ, AI SDK (+ anthropic, openai), cva,
      lucide; dev: Vitest, RTL, Playwright, tsx, Prettier (+ Tailwind plugin).
- [x] shadcn/ui initialized (`base-nova`) with button, input, card, badge, dialog, dropdown-menu, sonner.
- [x] Design tokens in `app/globals.css` (`@theme`), mapped to shadcn semantic vars; `bg-board` and `marker-yellow`
      utilities; fonts (Plus Jakarta Sans + Noto Sans) in `app/layout.tsx`.
- [x] Component skeleton: `components/{brand,motion,marketing,app}`, `features/`, `content/`, `pdf/`.
- [x] Brand primitives: PillButton, StickyNote, BoardCanvas, YellowMarker, Logo, SectionHeading/Eyebrow.
- [x] Motion primitive: Reveal (reduced-motion aware).
- [x] Token showcase home page composed only from primitives.
- [x] Shared lib: `env.ts`, `utils.ts`, `queue/` (names, zod payloads, `enqueue`), `supabase/{server,client,admin}`,
      `ai/provider.ts`, `calc/money.ts`, `entities/labels.ts`.
- [x] Worker: `worker/index.ts` (health queue, graceful shutdown), `logger.ts`, `load-env.ts`, `Dockerfile`.
- [x] Infra: `docker-compose.yml` (redis + opt-in worker), `supabase init`, `.env.example`.
- [x] Tooling: scripts `typecheck`, `test`, `e2e`, `format`, `worker:dev`, `queue:ping`, `check`; Vitest +
      Playwright configs; smoke e2e test.

## Acceptance criteria

- `npm run check` green; `npm run build` succeeds.
- `npm run dev` shows the token showcase with correct fonts/colors.
- With Redis running: `npm run worker:dev` + `npm run queue:ping` → worker logs and returns `{ ok: true }`.
- `npx supabase start` boots (requires Docker Desktop).

## Tests

- `lib/calc/money.test.ts` (parsing, rounding, float-drift guard, formatting).
- `components/brand/brand.test.tsx`, `components/motion/reveal.test.tsx`.
- `tests/e2e/smoke.spec.ts`.
