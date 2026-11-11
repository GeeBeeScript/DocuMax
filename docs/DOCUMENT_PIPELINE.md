# Document Pipeline

`process-document` job, implemented in `worker/processors/process-document.ts`, composed of pure-ish stage functions
in `lib/pipeline/*` so each stage is unit-testable with fixtures.

## Stage 1 — Text extraction (Phase 4)

1. Download the file from storage (`{org_id}/documents/{id}/…`).
2. Compute `sha256` (if not already) → duplicate-file check happens in validation.
3. **PDF:** extract the text layer per page with `unpdf`.
   - A page is **sparse** when it has < 40 non-whitespace characters (`OCR_MIN_CHARS_PER_PAGE`).
   - If > 50% of pages are sparse → OCR those pages.
4. **OCR:** render the page to PNG at 300 DPI (pdfjs + `@napi-rs/canvas`), preprocess with `sharp` (grayscale,
   normalize, deskew-light), run `tesseract.js` (`eng` by default; org language setting later). Store per-page OCR
   confidence.
5. **Images:** `sharp` preprocessing (rotate by EXIF, convert HEIC/WEBP → PNG) → OCR.
6. Persist `document_pages` (`text`, `source`, `ocr_confidence`). Status → `analyzing`.

Limits: 30 pages max per document in v1 (configurable); larger files fail with a clear message.

## Stage 2 — AI extraction (Phase 5)

- Model: `extractionModel()` from `lib/ai/provider.ts` (provider/model via env). Use `generateObject` (or the AI
  SDK's structured output API) with the zod schema below.
- Input: concatenated page text with page markers (`--- page 2 ---`), org context (entity kind, entity names/codes
  for matching, known suppliers), and the category list. If OCR confidence is low and the provider supports vision,
  page images may be attached as well.
- The prompt instructs the model to **copy values as printed** and never compute missing totals.
- Temperature 0. Up to 2 retries on schema failure; then status `failed` with the validation error.

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

Final confidence per field = `min(model confidence, ocr factor)` where `ocr factor` = page OCR confidence for
OCR-sourced pages (1.0 for text-layer pages). `records.min_confidence` = minimum over required fields.

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

## Phase 3 stub and guard rails

Until Phases 4–6 land, `worker/processors/process-document.ts` walks `queued → extracting → analyzing →
validating → ready` with `STUB_STEP_MS` pauses (default 800 ms) so the UI runs against real, live status changes.
The parts that stay when real stages replace the pauses:

- `forOrg(db, orgId).requireRow("documents", id)` — the payload's org must own the document.
- The file must exist in Storage, else the document fails with a clear message.
- Every step is `transition_document(org, doc, [from], to)`: a stale or duplicate job gets `null` back and stops,
  so retries are idempotent. Job ids are `{documentId}-{attempts}` (one job per attempt).
- After the last BullMQ attempt fails, `markDocumentFailed` records the error on the document.
