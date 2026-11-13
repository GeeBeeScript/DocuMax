# DocuMax

AI document processing for property managers and home-service contractors: upload supplier invoices and receipts,
get checked structured data, review it, and produce polished monthly cost statements per property or job.

> Contributors and AI agents: start with [AGENTS.md](AGENTS.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## Prerequisites

- Node.js ≥ 22
- Docker Desktop (for Redis and local Supabase)
- Supabase CLI (`npx supabase`)

## Local setup

```bash
npm install
cp .env.example .env.local          # fill in values (see below)
docker compose up -d redis          # Redis for the job queue
npx supabase start                  # local Postgres/Auth/Storage; copy keys from `npx supabase status`
npm run dev                         # web app on http://localhost:3000
npm run worker:dev                  # background worker (separate terminal)
npm run queue:ping                  # verify web → Redis → worker round-trip
```

## Scripts

| Script                     | What it does                                           |
| -------------------------- | ------------------------------------------------------ |
| `npm run dev`              | Next.js dev server (Turbopack)                         |
| `npm run worker:dev`       | BullMQ worker with watch mode                          |
| `npm run check`            | Lint + typecheck + unit tests                          |
| `npm test`                 | Unit tests (Vitest)                                    |
| `npm run test:integration` | Integration + tenancy isolation suite (local Supabase) |
| `npm run db:reset`         | Re-apply migrations locally                            |
| `npm run db:types`         | Regenerate DB types                                    |
| `npm run e2e`              | Playwright end-to-end tests                            |
| `npm run format`           | Prettier                                               |
| `npm run build`            | Production build                                       |

## Documentation

| Doc                                                         | Contents                               |
| ----------------------------------------------------------- | -------------------------------------- |
| [PRD](docs/PRD.md)                                          | Product requirements and personas      |
| [Architecture](docs/ARCHITECTURE.md)                        | System design, pipeline, deployment    |
| [Data model](docs/DATA_MODEL.md)                            | Tables and status machines             |
| [Multi-tenancy](docs/MULTI_TENANCY.md)                      | RLS, roles, isolation tests            |
| [Document pipeline](docs/DOCUMENT_PIPELINE.md)              | OCR, AI schema, validation, review     |
| [Design system](docs/DESIGN_SYSTEM.md)                      | Tokens, type, components, page mapping |
| [Conventions](docs/CONVENTIONS.md)                          | Code structure and componentization    |
| [Testing](docs/TESTING.md)                                  | Test strategy                          |
| [Roadmap](docs/ROADMAP.md) · [Decisions](docs/DECISIONS.md) | Phases and ADRs                        |
