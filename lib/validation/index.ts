import { dateSuspicious } from "./rules/date-suspicious";
import { duplicate } from "./rules/duplicate";
import { duplicateFile } from "./rules/duplicate-file";
import { lineMath } from "./rules/line-math";
import { linesMismatch } from "./rules/lines-mismatch";
import { lowConfidence } from "./rules/low-confidence";
import { missingField } from "./rules/missing-field";
import { noEntity } from "./rules/no-entity";
import { totalMismatch } from "./rules/total-mismatch";
import type { RecordForValidation, ValidationContext, ValidationIssue } from "./types";

export * from "./types";
export { normalizeInvoiceNumber, normalizeSupplier } from "./normalize";
export { requiredFields, FIELD_LABELS } from "./required-fields";

/** Rules in display order (errors first). */
const RULES = [
  duplicateFile,
  duplicate,
  missingField,
  totalMismatch,
  linesMismatch,
  lineMath,
  lowConfidence,
  dateSuspicious,
  noEntity,
];

/** Stage 3: every issue for a record. Pure — the same code runs in the worker, server actions and the browser. */
export function validateRecord(record: RecordForValidation, ctx: ValidationContext): ValidationIssue[] {
  return RULES.flatMap((rule) => rule(record, ctx));
}

export interface Routing {
  documentStatus: "needs_review" | "ready";
  recordStatus: "needs_review" | "approved";
}

/**
 * Stage 4: any issue → review. Clean records make the document `ready`; the record stays `needs_review` unless the
 * org enabled auto-approve (then the system approves it).
 */
export function routeRecord(
  issues: readonly ValidationIssue[],
  { autoApprove }: { autoApprove: boolean },
): Routing {
  if (issues.length > 0) return { documentStatus: "needs_review", recordStatus: "needs_review" };
  return { documentStatus: "ready", recordStatus: autoApprove ? "approved" : "needs_review" };
}

/** Errors first, then warnings; stable within severity. */
export function sortIssues<T extends { severity: string }>(issues: readonly T[]): T[] {
  return [...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
}
