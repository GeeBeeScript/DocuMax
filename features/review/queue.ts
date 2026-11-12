import type { IssueCode, Severity } from "@/lib/validation/types";
import { normalizeSupplier } from "@/lib/validation/normalize";
import type { QueueFilters } from "./filters";

/** The review queue's pure parts: row shape, order, filters, counts (unit-tested; no I/O). */

export interface QueueIssue {
  code: IssueCode;
  severity: Severity;
}

export interface QueueItem {
  id: string;
  documentId: string | null;
  fileName: string | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  totalCents: number | null;
  currency: string | null;
  entityId: string | null;
  entityName: string | null;
  minConfidence: number;
  issues: QueueIssue[];
  createdAt: string;
}

export type QueueCounts = Partial<Record<IssueCode | "clean", number>>;

const rank = (item: QueueItem) =>
  item.issues.some((i) => i.severity === "error") ? 0 : item.issues.length ? 1 : 2;

/** Queue order (docs/DOCUMENT_PIPELINE.md → Review): errors first, then warnings, then clean; oldest first within. */
export function sortQueue(items: readonly QueueItem[]): QueueItem[] {
  return [...items].sort(
    (a, b) => rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

/** Applies URL filters; `threshold` is the org's review threshold. */
export function filterQueue(
  items: readonly QueueItem[],
  filters: QueueFilters,
  threshold: number,
): QueueItem[] {
  const supplier = filters.supplier ? normalizeSupplier(filters.supplier) : null;
  return items.filter((item) => {
    if (filters.issue === "clean" && item.issues.length > 0) return false;
    if (filters.issue && filters.issue !== "clean" && !item.issues.some((i) => i.code === filters.issue))
      return false;
    if (filters.entity && item.entityId !== filters.entity) return false;
    if (supplier && !normalizeSupplier(item.supplierName ?? "")?.includes(supplier)) return false;
    if (filters.confidence === "low" && item.minConfidence >= threshold) return false;
    if (filters.confidence === "ok" && item.minConfidence < threshold) return false;
    return true;
  });
}

export function countIssues(items: readonly QueueItem[]): QueueCounts {
  const counts: QueueCounts = {};
  for (const item of items) {
    if (item.issues.length === 0) counts.clean = (counts.clean ?? 0) + 1;
    for (const code of new Set(item.issues.map((i) => i.code))) counts[code] = (counts[code] ?? 0) + 1;
  }
  return counts;
}
