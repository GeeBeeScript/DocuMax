# Phase 5 — AI extraction ✅

**Goal:** turn page text into the fixed, schema-validated structure with per-field confidence.

> Before implementing, check the provider's current docs for model IDs and structured-output guidance.

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

## Completion evidence (2026-11-14)

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
- [x] **≥ 90% of fixtures correct** — with the default model (ADR-018): 9/9 and 9/9 on two full runs, plus 4/4 of a
      third that stopped when the account's credit ran out (runs 5–7 below).

## Eval results

| Date       | Model (provider)                                       | Result         | Notes                                                                                                                                                           |
| ---------- | ------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-14 | heuristic dev model (`mock`)                           | 5/9 (56%)      | harness check only; not a quality measure                                                                                                                       |
| 2026-11-14 | `nvidia/nemotron-3.5-super-vl:free` (OpenRouter, open) | 8/9 (89%)      | miss was an **OCR bug**: automatic page layout dropped a receipt's TOTAL line; the model correctly returned null instead of adding up the lines → fixed (PSM 6) |
| 2026-11-14 | same, after the OCR fix                                | 8/9 (89%)      | utility bill "Statement date" not read as the issue date (varied between runs) → prompt now names common date labels                                            |
| 2026-11-14 | same, after the prompt change                          | **9/9 (100%)** | ≈ 1K input + 4K output tokens and 16–98 s per document on the free endpoint                                                                                     |

Production configuration — `nvidia/nemotron-3.5-super-vl` (paid endpoint), zero-retention routing:

| Run | Prompt                                        | Result               | Notes                                                            |
| --- | --------------------------------------------- | -------------------- | ---------------------------------------------------------------- |
| 1   | as above                                      | 9/9                  |                                                                  |
| 2   | as above                                      | 8/9                  | guessed USD on an invoice that prints no currency                |
| 3   | "never infer currency" wording                | 7/9                  | over-corrected: returned null although "$" was printed           |
| 4   | same                                          | 9/9                  |                                                                  |
| 5   | currency from printed code/symbol ($ → USD …) | **9/9**              | final prompt                                                     |
| 6   | same                                          | **9/9**              |                                                                  |
| 7   | same                                          | **4/4** (+5 not run) | stopped: OpenRouter credit exhausted (errors, not wrong answers) |

≈ $0.02 per 9-document run (≈ 1K input + 4–6K output tokens per document), 5–30 s per document. Anthropic Sonnet 5.5
was not measured (no credit); the owner chose the open model. Currency was the only unstable field — re-run the
eval twice after any prompt or model change.
