# Phase 3 — Entities & uploads ✅

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

## Completion evidence (2026-11-12)

- [x] Migration `20261112090000_entities_documents.sql`: tables, RLS (forced), audit, column grants, status
      functions (ADR-012), documents bucket limits (25 MB + MIME list), realtime publication. Isolation suite covers
      both tables (seeders added; the suite failed until they were).
- [x] Entities: `/app/entities` card grid ⇄ table, Active/Archived, create/edit dialog, archive/restore; wording via
      `entityLabels()` (now incl. field labels/examples); nav label follows the org's mode.
- [x] Uploads: `FileDropzone` → `requestUpload` → XHR PUT with progress (3 concurrent) → `confirmUpload` (size check,
      queued, enqueue); Web Crypto sha256 duplicate warning; optional entity assignment.
- [x] Documents list (live statuses, `aria-live`), detail with `DocumentPreview` (pdf.js + thumbnails, zoomable
      images, HEIC fallback), retry for failed; worker stub with idempotent, org-checked transitions.
- [x] **Acceptance run** (production build, worker, throttled upload ≈60 KB/s): 20 PDFs dropped at once → per-file
      progress, never more than 3 uploading at a time, all 20 reached Ready live with no page reload; `.txt` and a
      26 MB PDF rejected client-side with clear messages (server + DB + bucket reject them too — integration tests).
- [x] Tests: unit 151 (upload rules, FileDropzone, UploadTray, upload queue incl. 20-file concurrency,
      DocumentPreview/ImageViewer, live DocumentList, entity components); integration 194 (isolation, DB guarantees,
      entity/document actions incl. real Storage uploads and enqueue payloads, worker stub); E2E 11 (upload → Ready).

## Follow-ups

- Uploads abandoned mid-way stay `uploading` (hidden from lists). Add a cleanup job (delete rows + objects older
  than 24 h) — Phase 11 hardening.
- HEIC/HEIF previews need server-side conversion (Phase 4 already converts for OCR; store a PNG rendition then).
- Usage caps on `requestUpload` arrive with billing (Phase 10).
