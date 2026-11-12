/** Validation types (docs/DOCUMENT_PIPELINE.md → Stage 3). Pure data — shared by worker, server and browser. */

export const ISSUE_CODES = [
  "duplicate_file",
  "duplicate",
  "missing_field",
  "total_mismatch",
  "lines_mismatch",
  "line_math",
  "low_confidence",
  "date_suspicious",
  "no_entity",
] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];
export type Severity = "error" | "warning";

export interface ValidationIssue {
  code: IssueCode;
  severity: Severity;
  /** Record field (snake_case, as in `records`) or `lines[i].field`; null for record-level issues. */
  field: string | null;
  message: string;
  details?: Record<string, unknown>;
}

export interface LineForValidation {
  position: number;
  quantity: string | null;
  unitPriceCents: number | null;
  amountCents: number | null;
}

export interface RecordForValidation {
  id?: string;
  documentType: string | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string | null;
  subtotalCents: number | null;
  taxCents: number | null;
  totalCents: number | null;
  entityId: string | null;
  /** Per-field confidence (0–1); corrected fields are 1. */
  fieldConfidence: Record<string, number>;
  lines: LineForValidation[];
}

/** Another record in the org that could be a duplicate. */
export interface DuplicateCandidate {
  id: string;
  supplierName: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  totalCents: number | null;
  fileName: string | null;
}

export interface ValidationContext {
  /** Today's date (YYYY-MM-DD), injected for deterministic tests. */
  today: string;
  /** organizations.review_threshold */
  threshold: number;
  /** Other documents in the org with the same file hash. */
  sameFile: { documentId: string; fileName: string }[];
  /** Other records in the org (pre-filtered loosely by the caller; rules apply the exact match). */
  candidates: DuplicateCandidate[];
}
