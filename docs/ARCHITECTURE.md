# Architecture

## Overview

```
 Browser ──► Next.js (Vercel) ──────────────► Supabase Postgres (RLS)
   │            │  Server Components            ▲        ▲
   │            │  Server Actions               │        │ service role, org-scoped
   │            │  Route Handlers (webhooks,    │        │
   │            │   downloads)                  │        │
   │            └──► enqueue() ──► Redis ──► Worker (Railway/Fly, Docker)
   │                            (BullMQ)         │  text extraction, OCR, AI, validation,
   │                                             │  PDF rendering (Playwright), ZIP
   ├── direct upload (signed URL) ──► Supabase Storage ◄──┘
   └── Realtime subscription ◄── Supabase Realtime (documents.status)
```

| Concern       | Choice                                                                      |
| ------------- | --------------------------------------------------------------------------- |
| Web           | Next.js 15 App Router at repo root, deployed on Vercel                      |
| Backend logic | Server Actions (mutations), Route Handlers (webhooks, file downloads)       |
| Long work     | Node worker in `worker/` (BullMQ), Docker image on Railway or Fly.io        |
| Queue         | Redis (Upstash in prod, Docker locally)                                     |
| DB / Auth     | Supabase Postgres + Supabase Auth via `@supabase/ssr`                       |
| Files         | Supabase Storage (S3-compatible); private buckets; signed URLs              |
| Live status   | Supabase Realtime on `documents` (RLS-filtered)                             |
| AI            | Vercel AI SDK, provider set by `AI_PROVIDER`/`AI_MODEL` (`lib/ai/provider`) |
| PDF           | HTML templates → Playwright Chromium `page.pdf()` in the worker             |
| Payments      | Stripe Checkout + Customer Portal + signed webhook (`/api/stripe/webhook`)  |

No separate Node API server: Next.js covers request/response work; the worker covers everything long-running
(see ADR-002).

## Shared code

`lib/` is framework-agnostic and imported by both the web app and the worker via the `@/` alias. Rules:

- `lib/` must not import from `app/`, `components/` or `features/`.
- Code that needs Next.js request context (`cookies()`) lives in `lib/supabase/server.ts` only and is marked
  `server-only`.
- The worker never imports React components except `pdf/` templates (rendered to static HTML).

## Document processing pipeline

```mermaid
sequenceDiagram
  participant U as User (browser)
  participant W as Next.js
  participant S as Storage
  participant Q as Redis/BullMQ
  participant K as Worker
  participant DB as Postgres
  U->>W: request upload (file meta)
  W->>DB: check usage cap, insert document (status=uploading)
  W-->>U: signed upload URL
  U->>S: PUT file ({org_id}/documents/{id})
  U->>W: confirm upload
  W->>DB: status=queued
  W->>Q: enqueue process-document {orgId, documentId}
  Q->>K: job
  K->>S: download file
  K->>K: text layer (unpdf) → OCR fallback (tesseract.js)
  K->>DB: document_pages, status=analyzing
  K->>K: AI extraction (zod schema + confidence)
  K->>DB: extraction + record + line_items, status=validating
  K->>K: validation rules (lib/validation)
  K->>DB: validation_issues, status=needs_review | ready
  DB-->>U: Realtime status updates throughout
```

Details: [DOCUMENT_PIPELINE.md](DOCUMENT_PIPELINE.md).

Implemented in Phase 3 as: `requestUpload` (zod-validated metadata, sha256 duplicate hint, signed upload URL created
with the **user's** client so storage policies apply, then the `uploading` row) → browser `PUT` with progress (3 at a
time) → `confirmUpload` (checks the stored object's size, `confirm_document_upload()`, `enqueue`). Since Phase 10
the `uploading` row is created by `create_document_upload()`, which counts the document against the month's cap in
the same transaction (`quota_exceeded` → nothing is created); a browser upload that fails calls
`cancel_document_upload()`, which removes the pending row and gives the quota back.

## Queues

| Queue              | Payload                 | Purpose                                |
| ------------------ | ----------------------- | -------------------------------------- |
| `health`           | `{ sentAt }`            | Liveness / `npm run queue:ping`        |
| `process-document` | `{ orgId, documentId }` | Extract → OCR → AI → validate → route  |
| `render-report`    | `{ orgId, reportId }`   | Render one PDF, upload, mark ready     |
| `batch-zip`        | `{ orgId, batchId }`    | Wait for child reports, zip, upload    |
| `import-csv`       | `{ orgId, importId }`   | Parse, validate, insert, report errors |

Payload schemas live in `lib/queue/jobs.ts`; always enqueue via `enqueue()` (validates first). Jobs must be
**idempotent** (safe to retry): use upserts keyed by document/report id, and check current status before acting.
Default: 3 attempts, exponential backoff from 5s.

## PDF rendering

- Templates are React components in `pdf/templates/*` composed from `pdf/components/*`, rendered to static HTML with
  `renderToStaticMarkup`, plus a print stylesheet (`pdf/styles/print.css`).
- Playwright `page.pdf({ format: "A4", displayHeaderFooter: true, headerTemplate, footerTemplate })` provides the
  logo/header and "Page X of Y" via `pageNumber`/`totalPages`.
- **Pagination is decided in code, not by the browser** (ADR-021): every block and table row has a fixed height in
  mm (`pdf/layout.ts` ↔ `pdf/styles/print.css`), `paginateTable()` splits tables into per-page chunks, and each page
  is its own `<section class="page">`. So headers repeat, rows never split, and every break shows
  carried-forward / brought-forward subtotals taken from `lib/calc` running totals. Long text is truncated
  (single-line cells), never wrapped.
- All figures come from `lib/calc` view-models (`buildStatement`, `buildPortfolio`, `buildQuote`) — templates only
  format.
- One browser instance per worker process (`worker/pdf/render.ts`), one context per job; `CHROMIUM_PATH` overrides
  the binary. System fonts only (the worker renders offline). The worker runs TSX templates through
  `tsconfig.worker.json` (Next keeps `"jsx": "preserve"`).
- Files: `{org}/reports/{report}.pdf`; a batch's ZIP (`fflate`, stored) at `{org}/batches/{batch}.zip`. Downloads go
  through `/app/reports/[id]/download` and `/app/reports/batches/[id]/download`, which redirect to 60-second signed
  URLs after an RLS-checked lookup.
- Template work: `npm run pdf:preview -- statement 60` writes `.preview/statement-60.html` + `.pdf` from fixtures
  (instead of an in-app dev route: Next refuses `react-dom/server` in the app bundle).

## Deployment

| Piece    | Where             | Notes                                                  |
| -------- | ----------------- | ------------------------------------------------------ |
| Web      | Vercel            | Env from Vercel project settings                       |
| Worker   | Railway or Fly.io | `worker/Dockerfile` (Playwright base image), ≥1 GB RAM |
| Redis    | Upstash           | TLS URL (`rediss://`) in `REDIS_URL`                   |
| Database | Supabase cloud    | Migrations applied via `supabase db push` in CI        |

Local: `docker compose up -d redis`, `npx supabase start`, `npm run dev`, `npm run worker:dev`.

## Observability (Phase 11)

Structured JSON logs (worker `logger`), Sentry for web + worker, BullMQ job metrics, and a `/api/health` endpoint.
