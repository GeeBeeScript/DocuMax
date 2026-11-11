# Phase 4 — Text extraction & OCR

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
