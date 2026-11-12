import "server-only";
import { getDocument, listDocumentPages, type DocumentDetail } from "@/features/documents/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import { loadValidationContext, toValidationRecord } from "@/lib/validation/load";
import type { IssueCode, ValidationContext } from "@/lib/validation/types";
import type { QueueFilters } from "./filters";
import { highlightPage } from "./highlight";
import { countIssues, filterQueue, sortQueue, type QueueCounts, type QueueItem } from "./queue";

export type { QueueCounts, QueueIssue, QueueItem } from "./queue";

export type RecordRow = Database["public"]["Tables"]["records"]["Row"];
export type LineItemRow = Database["public"]["Tables"]["line_items"]["Row"];
export type RecordStatus = Database["public"]["Enums"]["record_status"];
export type ReviewActionType = Database["public"]["Enums"]["review_action_type"];

/** The oldest this-many records awaiting review are loaded; filters and counts apply to them (bulk approve ≤ 200). */
export const QUEUE_LIMIT = 500;

export interface ReviewQueue {
  items: QueueItem[];
  /** Records per issue code across the whole queue (unfiltered) — a record with two codes counts twice. */
  counts: QueueCounts;
  /** Records awaiting review (unfiltered). */
  total: number;
}

async function loadQueue(orgId: string): Promise<QueueItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("records")
    .select(
      `id, document_id, supplier_name, invoice_number, issue_date, total_cents, currency, entity_id, min_confidence,
       created_at, document:documents(file_name), entity:entities(name),
       issues:validation_issues(code, severity, resolved_at)`,
    )
    .eq("org_id", orgId)
    .eq("status", "needs_review")
    .order("created_at")
    .order("id")
    .limit(QUEUE_LIMIT);
  if (error) throw error;
  return sortQueue(
    data.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      fileName: r.document?.file_name ?? null,
      supplierName: r.supplier_name,
      invoiceNumber: r.invoice_number,
      issueDate: r.issue_date,
      totalCents: r.total_cents,
      currency: r.currency,
      entityId: r.entity_id,
      entityName: r.entity?.name ?? null,
      minConfidence: Number(r.min_confidence),
      issues: r.issues
        .filter((i) => !i.resolved_at)
        .map((i) => ({ code: i.code as IssueCode, severity: i.severity }))
        .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1)),
      createdAt: r.created_at,
    })),
  );
}

/** Records awaiting review (RLS: members), filtered, with counts by issue code. */
export async function listReviewQueue(
  orgId: string,
  filters: QueueFilters,
  threshold: number,
): Promise<ReviewQueue> {
  const all = await loadQueue(orgId);
  return { items: filterQueue(all, filters, threshold), counts: countIssues(all), total: all.length };
}

// ---------------------------------------------------------------------------------------------------------------
// One record
// ---------------------------------------------------------------------------------------------------------------

export interface TimelineEvent {
  id: string;
  action: ReviewActionType | "extracted";
  field: string | null;
  before: Json | null;
  after: Json | null;
  reason: string | null;
  /** null = DocuMax (worker / auto-approve). */
  actorName: string | null;
  createdAt: string;
}

export interface ReviewItem {
  record: RecordRow;
  lineItems: LineItemRow[];
  entityName: string | null;
  approverName: string | null;
  document: DocumentDetail | null;
  /** Page to open the preview on: where the first flagged value is printed (1 when unknown). */
  initialPage: number;
  /** Serializable context so the browser can re-validate live with the same rules as the server. */
  context: ValidationContext;
  timeline: TimelineEvent[];
  allocations: {
    entityId: string;
    lineItemId: string | null;
    method: "percent" | "amount";
    percentBp: number | null;
    amountCents: number | null;
  }[];
  /** Neighbours in the (filtered) queue, for J/K and "next item" after a decision. */
  prevId: string | null;
  nextId: string | null;
  position: number | null;
  queueSize: number;
}

const personName = (p: { full_name: string | null; email: string } | null) =>
  p?.full_name || p?.email || null;

export async function getRecordTimeline(orgId: string, record: RecordRow): Promise<TimelineEvent[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("review_actions")
    .select("id, action, field, before, after, reason, created_at, actor:profiles(full_name, email)")
    .eq("org_id", orgId)
    .eq("record_id", record.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return [
    ...data.map((a) => ({
      id: a.id,
      action: a.action,
      field: a.field,
      before: a.before,
      after: a.after,
      reason: a.reason,
      actorName: personName(a.actor),
      createdAt: a.created_at,
    })),
    {
      id: `extracted-${record.id}`,
      action: "extracted" as const,
      field: null,
      before: null,
      after: null,
      reason: null,
      actorName: null,
      createdAt: record.created_at,
    },
  ];
}

export async function getReviewItem(
  orgId: string,
  recordId: string,
  filters: QueueFilters,
  threshold: number,
): Promise<ReviewItem | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("records")
    .select(
      `*, entity:entities(name), line_items(*), approver:profiles!records_approved_by_fkey(full_name, email),
       issues:validation_issues(field, resolved_at),
       allocations(entity_id, line_item_id, method, percent_bp, amount_cents)`,
    )
    .eq("org_id", orgId)
    .eq("id", recordId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { entity, line_items, approver, issues, allocations, ...record } = data;
  const lineItems = [...line_items].sort((a, b) => a.position - b.position);

  const [document, pages, queue, timeline] = await Promise.all([
    record.document_id ? getDocument(orgId, record.document_id) : Promise.resolve(null),
    record.document_id ? listDocumentPages(orgId, record.document_id) : Promise.resolve([]),
    loadQueue(orgId).then((all) => filterQueue(all, filters, threshold)),
    getRecordTimeline(orgId, record),
  ]);
  const { autoApprove: _autoApprove, ...context } = await loadValidationContext(supabase, {
    orgId,
    record: toValidationRecord(record, lineItems),
    documentId: record.document_id,
    sha256: document ? await documentSha(orgId, document.id) : null,
  });

  const index = queue.findIndex((q) => q.id === record.id);
  // Not in the queue (decided, or filtered out): J/K walk the queue from its start.
  const prevId = index > 0 ? queue[index - 1]!.id : null;
  const nextId = index >= 0 ? (queue[index + 1]?.id ?? null) : (queue[0]?.id ?? null);

  const flaggedField = issues.find((i) => !i.resolved_at && i.field)?.field ?? null;
  return {
    record,
    lineItems,
    entityName: entity?.name ?? null,
    approverName: personName(approver),
    document,
    initialPage: highlightPage(pages, record, flaggedField),
    context,
    timeline,
    allocations: allocations.map((a) => ({
      entityId: a.entity_id,
      lineItemId: a.line_item_id,
      method: a.method,
      percentBp: a.percent_bp,
      amountCents: a.amount_cents,
    })),
    prevId,
    nextId,
    position: index >= 0 ? index + 1 : null,
    queueSize: queue.length,
  };
}

async function documentSha(orgId: string, documentId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("documents")
    .select("sha256")
    .eq("org_id", orgId)
    .eq("id", documentId)
    .maybeSingle();
  return data?.sha256 ?? null;
}
