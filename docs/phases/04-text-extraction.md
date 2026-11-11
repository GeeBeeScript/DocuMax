# Phase 4 — Text extraction & OCR ✅

**Goal:** reliable per-page text for every document, with OCR fallback for scanned files and images.

## Scope

- Deps: `unpdf`, `pdfjs-dist`, `@napi-rs/canvas`, `tesseract.js`, `sharp`.
- `lib/pipeline/extract-text.ts` (text layer), `lib/pipeline/ocr.ts` (render + preprocess + tesseract),
  `lib/pipeline/route-text.ts` (sparse-page decision) — per [DOCUMENT_PIPELINE.md](../DOCUMENT_PIPELINE.md).
- Migration: `document_pages`.
- Worker processor stage 1; tesseract worker pool reused across jobs; language data cached in the image.
- Document detail page: "Extracted text" tab per page with source badge (text layer / OCR) and OCR confidence.
- Fixtures: digital PDF invoice, scanned PDF invoice, phone photo receipt, mixed PDF.

## Acceptance criteria

- Digital PDFs skip OCR; scanned PDFs and images are OCR'd; mixed PDFs OCR only sparse pages.
- 3-page scanned invoice processed in < 30s on the worker size in ARCHITECTURE.md.
- Failures (corrupt PDF, password-protected) set `failed` with a readable error.

## Tests

- Unit: sparse-page routing, preprocessing parameters.
- Fixture tests: expected key strings found in extracted text for each fixture (OCR tests tagged slow).

## Completion evidence (2026-11-13)

- [x] `lib/pipeline/{config,errors,route-text,pdf,preprocess,images,ocr,extract-document}.ts`; deps `unpdf`,
      `pdfjs-dist`, `@napi-rs/canvas`, `tesseract.js`, `sharp`, `@tesseract.js-data/eng`, `heic-decode`.
- [x] Migration `20261113090000_document_pages.sql` (RLS forced, worker-only writes via `save_document_pages()`);
      isolation suite covers `document_pages` (it failed until a seeder was registered).
- [x] Worker stage 1 with a reused Tesseract pool (bundled language data); stages 2–3 still stubbed.
- [x] Detail page "Extracted text" tab: per page, source badge (text layer / OCR + confidence band), low-confidence
      warning.
- [x] Fixtures: digital, scanned 3-page, mixed, phone photo receipt (+ corrupt, password-protected), with generator.
- [x] **Acceptance:** digital PDFs skip OCR, scanned PDFs and images are OCR'd, mixed PDFs OCR only the sparse page
      (unit, slow, integration and E2E tests); 3-page scanned invoice ≈ 5 s (budget 30 s; 4 vCPU sandbox — the
      worker spec in ARCHITECTURE.md gives RAM, not CPU, so re-measure on the real instance); corrupt and
      password-protected PDFs fail with readable messages (integration + real-browser run).
- [x] Tests: unit 184 (routing, Otsu, preprocessing, error mapping, components, status merging); slow OCR 4 fixture
      tests; integration 212 (incl. worker stage 1 on real fixtures with real OCR); E2E 12 (scanned PDF → OCR text).

## Notes

- Deviation: OCR every sparse page (not "only if > 50% sparse"), Otsu instead of normalize/deskew — ADR-013.
- HEIC decoding via WASM, not yet tested on a real iPhone file — ADR-014.
- Found while verifying: a real-browser run showed documents that failed within ~1 s of page load keeping a stale
  status (events during channel join are not delivered). Fixed with a re-fetch on `SUBSCRIBED` and `updated_at`
  merging; covered by tests.
