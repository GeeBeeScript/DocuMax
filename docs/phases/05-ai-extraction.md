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
