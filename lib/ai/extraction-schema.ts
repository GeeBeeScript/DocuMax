import { z } from "zod";

/**
 * AI extraction schema (docs/DOCUMENT_PIPELINE.md → Stage 2). `schema_version` is stored with every extraction so
 * records can be re-mapped if the schema changes.
 *
 * Two layers:
 * - `ModelExtraction` is what the model is asked to fill. Plain JSON types only (strings, numbers, enums, null) so
 *   every provider's structured-output mode accepts it.
 * - `InvoiceExtraction` is the strict contract the rest of the code relies on (ISO dates, 3-letter currency,
 *   confidence in 0–1). Model output must pass it; failures trigger a retry (lib/ai/extract.ts).
 *
 * Amounts are strings exactly as printed — the model never does arithmetic (non-negotiable #3); lib/calc parses them.
 */

export const SCHEMA_VERSION = 1;

export const CATEGORIES = [
  "repairs_maintenance",
  "materials",
  "labor_subcontract",
  "utilities",
  "cleaning",
  "landscaping",
  "insurance",
  "taxes_fees",
  "professional_services",
  "equipment_rental",
  "travel_fuel",
  "office_admin",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const DOCUMENT_TYPES = ["invoice", "receipt", "credit_note", "quote", "statement", "other"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Field shape for the model: a value (or null when absent) and the model's confidence. */
const modelField = <T extends z.ZodType>(value: T) =>
  z.object({ value: value.nullable(), confidence: z.number() });

/** Field shape after validation. */
const strictField = <T extends z.ZodType>(value: T) =>
  z.object({ value: value.nullable(), confidence: z.number().min(0).max(1) });

function buildSchema(
  field: typeof strictField,
  kinds: { date: z.ZodType<string>; currency: z.ZodType<string> },
) {
  return z.object({
    documentType: field(z.enum(DOCUMENT_TYPES)),
    supplier: z.object({
      name: field(z.string()),
      taxId: field(z.string()),
      address: field(z.string()),
    }),
    invoiceNumber: field(z.string()),
    issueDate: field(kinds.date),
    dueDate: field(kinds.date),
    currency: field(kinds.currency),
    subtotal: field(z.string()),
    tax: z.object({ amount: field(z.string()), rate: field(z.string()) }),
    total: field(z.string()),
    category: field(z.enum(CATEGORIES)),
    entityHint: field(z.string()),
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
}

export const ModelExtraction = buildSchema(modelField as typeof strictField, {
  date: z.string(),
  currency: z.string(),
});

export const InvoiceExtraction = buildSchema(strictField, {
  date: z.iso.date(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter ISO 4217 code"),
});

export type ModelExtractionOutput = z.infer<typeof ModelExtraction>;
export type InvoiceExtractionResult = z.infer<typeof InvoiceExtraction>;
export type ExtractedField<T> = { value: T | null; confidence: number };
