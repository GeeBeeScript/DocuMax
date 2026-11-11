# Phase 3 — Entities & uploads

**Goal:** users manage properties/jobs and upload documents (single + bulk) with preview and live status.

## Scope

- Migrations: `entities`, `documents` (+ RLS, audit, isolation coverage automatic).
- Entities CRUD (list as card grid + table toggle, create/edit dialog, archive); labels via `entityLabels()`.
- Upload flow: `FileDropzone` (drag/drop, multi-select, type/size validation) → `requestUpload` action (creates
  document row `uploading`, returns signed upload URL) → direct PUT to Storage with progress → `confirmUpload`
  (status `queued`, enqueue `process-document`). Concurrency limit 3 uploads; `UploadTray` shows per-file progress.
- `sha256` computed client-side (Web Crypto) for early duplicate warning.
- Document list + detail page: `DocumentPreview` (pdf.js viewer with thumbnails; image viewer with zoom),
  `StatusBadge`, retry button for `failed`.
- Live status via Supabase Realtime subscription (`useDocumentStatus` hook), `aria-live` announcements.
- Worker stub processor for `process-document` that walks statuses (real stages land in Phases 4–6).

## Acceptance criteria

- Upload 20 files at once; each shows progress then live status changes without refresh.
- Files stored under `{org_id}/documents/{document_id}/…`; cross-org access denied (isolation suite).
- Unsupported types / > 25 MB rejected client- and server-side with clear messages.

## Tests

- `FileDropzone`, `UploadTray`, `StatusBadge`, `DocumentPreview` component tests.
- Action tests: `requestUpload` / `confirmUpload` role + validation; enqueue called with valid payload.
- E2E: upload a PDF and see it reach the stub's final status.
