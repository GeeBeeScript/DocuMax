# Phase 5 — AI extraction

**Goal:** turn page text into the fixed, schema-validated structure with per-field confidence.

> Before implementing, load the `claude-api` skill for current model IDs and structured-output guidance.

## Scope

- `lib/ai/extraction-schema.ts` (`InvoiceExtraction`, `CATEGORIES`, `schema_version`) per
  [DOCUMENT_PIPELINE.md](../DOCUMENT_PIPELINE.md).
- `lib/ai/extract.ts`: builds the prompt (page markers, org context, entity list, categories), calls
  `extractionModel()` with structured output, retries on schema failure, returns typed result + usage metrics.
- `lib/pipeline/map-extraction.ts`: converts extraction → `records` + `line_items` rows (amounts via
  `parseToCents`), computes combined confidence, matches `entityHint` to entities (fuzzy on name/address/code).
- Migrations: `extractions`, `records`, `line_items`.
- Worker stage 2 wired after stage 1; status `analyzing` → `validating`.
- Record detail view (read-only for now) showing fields with `ConfidencePill`.
- Cost/latency logging per extraction (tokens, ms, model).

## Acceptance criteria

- On the fixture set, required fields extracted correctly for ≥ 90% of fixtures (measured by an eval script
  `scripts/eval-extraction.ts` against labeled fixture JSON).
- Switching `AI_PROVIDER`/`AI_MODEL` requires no code change.
- Model output never feeds arithmetic directly; amounts are parsed strings.

## Tests

- Schema tests against recorded outputs (valid, partially null, malformed → retry path).
- `map-extraction` unit tests (cents parsing, confidence combination, entity matching).
- AI calls mocked in CI; eval script run manually / nightly.

## Status (2026-11-14): built, real-model eval pending

Not marked done: the main acceptance criterion needs a run against a real model, which needs an API key in the
environment (none is configured yet).

- [x] `lib/ai/extraction-schema.ts` (two layers, `SCHEMA_VERSION` 1), `lib/ai/prompt.ts`, `lib/ai/extract.ts`
      (structured output, retries with validation feedback, usage incl. failed attempts, refusal handling).
- [x] `lib/pipeline/map-extraction.ts` (cents, combined confidence, entity matching) + hardened `parseToCents`.
- [x] Migration `20261114090000_extractions_records.sql`; `save_extraction()`; isolation suite covers all three
      tables (failed until seeders were registered).
- [x] Worker stage 2 (`analyzing → validating`), cost/latency logging; validation still stubbed (Phase 6).
- [x] Read-only "Extracted data" view with `ConfidencePill`; list shows the matched property/job without reload.
- [x] **Switching provider/model needs no code change** — `AI_PROVIDER` / `AI_MODEL` / `AI_EFFORT` only.
- [x] **Model output never feeds arithmetic** — amounts are strings parsed by `lib/calc` (tests).
- [x] Tests: schema on recorded outputs (valid / partially null / invalid / malformed → retry), `map-extraction`
      unit tests, mocked AI in CI (unit 255, integration 249), E2E with the dev model (13).
- [~] **≥ 90% of fixtures correct** — met with an open model, not yet with the configured default (see below).

## To finish

1. Add an Anthropic API key to the environment (Settings → environment → network secrets for
   `api.anthropic.com`, header `x-api-key`), or `ANTHROPIC_API_KEY` in `.env.local` locally.
2. `npm run eval:extraction` (≈ 9 model calls). If < 90%, iterate on `lib/ai/prompt.ts` against the eval.
3. Record the result here and mark the phase done.

## Eval results

| Date       | Model (provider)                                       | Result         | Notes                                                                                                                                                           |
| ---------- | ------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-14 | heuristic dev model (`mock`)                           | 5/9 (56%)      | harness check only; not a quality measure                                                                                                                       |
| 2026-11-14 | `nvidia/nemotron-3.5-super-vl:free` (OpenRouter, open) | 8/9 (89%)      | miss was an **OCR bug**: automatic page layout dropped a receipt's TOTAL line; the model correctly returned null instead of adding up the lines → fixed (PSM 6) |
| 2026-11-14 | same, after the OCR fix                                | 8/9 (89%)      | utility bill "Statement date" not read as the issue date (varied between runs) → prompt now names common date labels                                            |
| 2026-11-14 | same, after the prompt change                          | **9/9 (100%)** | ≈ 1K input + 4K output tokens and 16–98 s per document on the free endpoint                                                                                     |

`anthropic/claude-sonnet-5.5` (the configured default, ADR-003) has not run yet: the OpenRouter account needs
credits. The phase is marked done once the model chosen as default passes. One 9-fixture run is a small sample (the
open model's results varied between runs); re-run before relying on a single score.
