# Document Pipeline

`process-document` job, implemented in `worker/processors/process-document.ts`, composed of pure-ish stage functions
in `lib/pipeline/*` so each stage is unit-testable with fixtures.

## Stage 1 — Text extraction (Phase 4)

1. Download the file from storage (`{org_id}/documents/{id}/…`).
2. Compute `sha256` (if not already) → duplicate-file check happens in validation.
3. **PDF:** extract the text layer per page with `unpdf`.
   - A page is **sparse** when it has < 40 non-whitespace characters (`OCR_MIN_CHARS_PER_PAGE`).
   - **Every sparse page is OCR'd**; pages with a real text layer never are (ADR-013). Digital PDFs skip OCR, scans
     are fully OCR'd, mixed PDFs OCR only their scanned pages.
4. **OCR:** render the page to PNG at 300 DPI (pdfjs via `unpdf` + `@napi-rs/canvas`), preprocess with `sharp`, run
   `tesseract.js` (`eng`; org language setting later). Store per-page OCR confidence (0–1).
   - Preprocessing (`lib/pipeline/preprocess.ts`): EXIF rotate → flatten transparency onto white → grayscale →
     bounded upscale of narrow images (to 1600 px, ≤ 2.5×) → **Otsu binarization**. No `normalize()` and no deskew
     (ADR-013).
   - Tesseract: one pool per worker process (`OCR_WORKERS`, default 2), reused across jobs; job concurrency matches
     the pool. Language data comes from the `@tesseract.js-data/eng` npm package (in `node_modules`, so baked into
     the worker image) — never downloaded at runtime.
5. **Images:** EXIF rotation and preprocessing as above → OCR. HEIC/HEIF is decoded with `heic-decode` (libheif in
   WASM) because prebuilt sharp lacks the HEVC decoder (ADR-014).
6. Persist pages with `save_document_pages()` (replaces the document's pages and moves `extracting → analyzing` in
   one transaction; also records `page_count` and `sha256`).

Limits: 30 pages max per document in v1 (`lib/pipeline/config.ts`); larger files fail with a clear message.

**Failures.** Permanent problems throw `PipelineError` and fail the document at once with a user-facing message
(no retries): corrupt/truncated PDF, password-protected PDF, too many pages, unreadable image, unsupported type.
Anything else is transient: the job throws, BullMQ retries (3 attempts), and a retry resumes from `extracting`.

**Measured** (4 vCPU sandbox, 2 OCR workers): scanned 3-page invoice ≈ 5 s end to end; digital page ≈ 0.1 s; phone
photo ≈ 0.9 s. All key strings (supplier, invoice no., dates, tax id, totals) found on every fixture.

## Stage 2 — AI extraction (Phase 5)

- Model: `extractionModel()` from `lib/ai/provider.ts` (provider/model via env, ADR-003). `lib/ai/extract.ts` calls
  `generateText` with `Output.object({ schema: ModelExtraction })` — the AI SDK uses each provider's native structured
  output (for current Claude models: `output_config.format`; they reject forced tool use).
- Input: concatenated page text with page markers (`--- page 2 ---`), org context (entity kind, entity names/codes
  for matching, known suppliers), and the category list. If OCR confidence is low and the provider supports vision,
  page images may be attached as well.
- The prompt instructs the model to **copy values as printed** and never compute missing totals.
- **No sampling parameters** (no `temperature`): current Claude models reject them, and the output is constrained by
  the schema instead (ADR-015). Anthropic requests opt into server-side refusal fallbacks (`fallbacks: "default"`);
  optional `AI_EFFORT` sets reasoning effort.
- Two schema layers (ADR-015): the model fills `ModelExtraction` (plain JSON types only, so every provider accepts
  it); the answer must then pass the strict `InvoiceExtraction` (ISO dates, ISO 4217, confidence 0–1). Up to 2
  retries, each with the validation errors fed back; then the document fails with a readable message. A refusal
  (after fallbacks) fails at once. Network/rate-limit/5xx errors are rethrown so BullMQ retries the job, which
  resumes at stage 2 without re-running OCR.
- Every extraction logs provider, model, attempts, latency and tokens (worker log + `extractions` row); tokens of
  failed attempts are counted too. No document text in logs.
- `AI_PROVIDER=mock` swaps in a deterministic regex-based dev model (`lib/ai/dev-model.ts`) for local development and
  E2E without an API key; it reports confidence 0.6 so everything routes to review, and is refused in production.

### Extraction schema (`lib/ai/extraction-schema.ts`, `schema_version` = 1)

```ts
const field = <T extends z.ZodType>(value: T) =>
  z.object({ value: value.nullable(), confidence: z.number().min(0).max(1) });

export const InvoiceExtraction = z.object({
  documentType: field(z.enum(["invoice", "receipt", "credit_note", "quote", "statement", "other"])),
  supplier: z.object({
    name: field(z.string()),
    taxId: field(z.string()),
    address: field(z.string()),
  }),
  invoiceNumber: field(z.string()),
  issueDate: field(z.iso.date()),
  dueDate: field(z.iso.date()),
  currency: field(z.string().length(3)),
  subtotal: field(z.string()), // decimal string as printed → parsed to cents by lib/calc/money
  tax: z.object({ amount: field(z.string()), rate: field(z.string()) }),
  total: field(z.string()),
  category: field(z.enum(CATEGORIES)),
  entityHint: field(z.string()), // e.g. property address / job reference seen on the document
  lineItems: z.array(
    z.object({
      description: field(z.string()),
      quantity: field(z.string()),
      unitPrice: field(z.string()),
      amount: field(z.string()),
      category: field(z.enum(CATEGORIES)),
    }),
  ),
});
```

Amounts are strings so the model never "rounds"; `parseToCents` converts them deterministically.

**Categories** (v1, shared by both modes): `repairs_maintenance`, `materials`, `labor_subcontract`, `utilities`,
`cleaning`, `landscaping`, `insurance`, `taxes_fees`, `professional_services`, `equipment_rental`, `travel_fuel`,
`office_admin`, `other`.

### Confidence

Final confidence per field = `min(model confidence, ocr factor)`. Fields aren't traced to pages, so the
`ocr factor` is the **lowest** OCR confidence among the document's OCR'd pages (1.0 when every page has a text
layer) — conservative by design. `records.min_confidence` = minimum over required fields (supplier name, issue date,
total, currency; plus invoice number for invoices). An amount the model returned that `parseToCents` can't parse is
stored as null with confidence 0.

### Mapping and entity matching (`lib/pipeline/map-extraction.ts`)

Amounts → cents via `lib/calc/money.ts` (`parseToCents` handles "1,234.56", "1.234,56", "1260.57 USD", "(12.50)",
"12.50-"). Quantities and tax rates stay decimal strings (never floats). The entity hint matches an active
property/job by code (exact or contained), else by name/address similarity ≥ 0.8 (normalized, street abbreviations
expanded, tolerant of OCR slips); near-ties return no match. An entity the user picked at upload always wins.

### Evaluation

`npm run eval:extraction` runs stage 1 + 2 on the labeled fixtures (`tests/fixtures/labels/extraction.json`) with
the configured provider and scores the required fields; the bar is ≥ 90% of fixtures fully correct. It calls the
real API (costs money): run manually or nightly, never in CI. `AI_PROVIDER=mock` checks the harness for free.

## Stage 3 — Validation (Phase 6, `lib/validation/*`, pure functions)

| Code              | Rule                                                                                        | Severity |
| ----------------- | ------------------------------------------------------------------------------------------- | -------- |
| `duplicate_file`  | same `sha256` in org                                                                        | error    |
| `duplicate`       | same normalized supplier + invoice number; or same supplier + issue date + total            | error    |
| `missing_field`   | required: supplier name, issue date, total, currency (invoice number required for invoices) | error    |
| `total_mismatch`  | `subtotal + tax ≠ total` (tolerance 1¢)                                                     | error    |
| `lines_mismatch`  | `Σ line amounts ≠ subtotal` (tolerance 1¢ × line count, max 5¢)                             | warning  |
| `line_math`       | `quantity × unit price ≠ amount` (tolerance 1¢)                                             | warning  |
| `low_confidence`  | any required field below `organizations.review_threshold` (default 0.85)                    | warning  |
| `date_suspicious` | issue date in the future or > 18 months old; due before issue                               | warning  |
| `no_entity`       | no entity matched or assigned                                                               | warning  |

All arithmetic uses `lib/calc`. Normalization (supplier names, invoice numbers) lives in `lib/validation/normalize.ts`.

## Stage 4 — Routing

- Any `error` or `warning` issue, or `min_confidence < threshold` → record `needs_review`, document `needs_review`.
- Otherwise → document `ready`, record stays `needs_review` **unless** the org enabled auto-approve
  (off by default), in which case it is `approved` by the system actor.

## Review (Phase 6)

- Queue: records in `needs_review`, sorted by severity then age; filters by entity, supplier, issue code.
- Review screen: document preview (left) + field form with confidence pills and issue banners (right); keyboard
  shortcuts (`A` approve, `R` reject, `J/K` next/prev, `E` edit field).
- Corrections re-run validation instantly (same `lib/validation` code client- and server-side).
- Every approve/reject/correct writes `review_actions` (with optional reason) and is captured by the audit trigger.

## Stub stages and guard rails

Stage 1 is real since Phase 4. Until Phases 5–6 land, `worker/processors/process-document.ts` walks
`analyzing → validating → ready` with `STUB_STEP_MS` pauses (default 800 ms). Guard rails that stay:

- `forOrg(db, orgId).requireRow("documents", id)` — the payload's org must own the document.
- The file must exist in Storage, else the document fails with a clear message.
- Every step is `transition_document(org, doc, [from], to)`: a stale or duplicate job gets `null` back and stops,
  so retries are idempotent. Job ids are `{documentId}-{attempts}` (one job per attempt).
- After the last BullMQ attempt fails, `markDocumentFailed` records the error on the document.
