import type { MappedRecord } from "@/lib/pipeline/map-extraction";
import { normalizeText, similarity } from "@/lib/pipeline/map-extraction";

/** Expected values for one labeled fixture (tests/fixtures/labels/extraction.json). Amounts in cents. */
export interface ExpectedFields {
  documentType: string | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  totalCents: number | null;
  currency: string | null;
}

/** The required fields scored per fixture (docs/DOCUMENT_PIPELINE.md → missing_field). */
export const SCORED_FIELDS = [
  "supplierName",
  "invoiceNumber",
  "issueDate",
  "totalCents",
  "currency",
] as const;
export type ScoredField = (typeof SCORED_FIELDS)[number];

const compactId = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Supplier names match when equal after normalization, or near-identical (OCR slips, "Co." vs "Co"). */
export function sameSupplier(actual: string | null, expected: string | null): boolean {
  if (actual == null || expected == null) return actual == expected;
  return normalizeText(actual) === normalizeText(expected) || similarity(actual, expected) >= 0.9;
}

export function scoreFields(record: MappedRecord, expected: ExpectedFields): Record<ScoredField, boolean> {
  return {
    supplierName: sameSupplier(record.supplier_name, expected.supplierName),
    invoiceNumber:
      record.invoice_number == null || expected.invoiceNumber == null
        ? record.invoice_number == expected.invoiceNumber
        : compactId(record.invoice_number) === compactId(expected.invoiceNumber),
    issueDate: record.issue_date === expected.issueDate,
    totalCents: record.total_cents === expected.totalCents,
    currency: record.currency === expected.currency,
  };
}

export interface FixtureScore {
  file: string;
  fields: Record<ScoredField, boolean>;
  correct: boolean;
}

export function summarize(scores: readonly FixtureScore[]) {
  const fixtures = scores.length;
  const correct = scores.filter((s) => s.correct).length;
  const perField = Object.fromEntries(
    SCORED_FIELDS.map((f) => [f, scores.filter((s) => s.fields[f]).length / Math.max(1, fixtures)]),
  ) as Record<ScoredField, number>;
  return { fixtures, correct, accuracy: fixtures ? correct / fixtures : 0, perField };
}
