import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { normalizeInvoiceNumber } from "./normalize";
import type { DuplicateCandidate, RecordForValidation, ValidationContext } from "./types";

/**
 * Loading the data validation needs. Shared by the worker (service-role client) and review Server Actions (the
 * user's RLS client); every query filters by org_id explicitly, so it is safe with either.
 */

type Db = SupabaseClient<Database>;
type RecordRow = Database["public"]["Tables"]["records"]["Row"];
type LineRow = Pick<
  Database["public"]["Tables"]["line_items"]["Row"],
  "position" | "quantity" | "unit_price_cents" | "amount_cents"
>;

/** DB rows → the shape rules validate. */
export function toValidationRecord(record: RecordRow, lines: readonly LineRow[]): RecordForValidation {
  return {
    id: record.id,
    documentType: record.document_type,
    supplierName: record.supplier_name,
    invoiceNumber: record.invoice_number,
    issueDate: record.issue_date,
    dueDate: record.due_date,
    currency: record.currency,
    subtotalCents: record.subtotal_cents,
    taxCents: record.tax_cents,
    totalCents: record.total_cents,
    entityId: record.entity_id,
    fieldConfidence: (record.field_confidence ?? {}) as Record<string, number>,
    lines: [...lines]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        position: l.position,
        quantity: l.quantity == null ? null : String(l.quantity),
        unitPriceCents: l.unit_price_cents,
        amountCents: l.amount_cents,
      })),
  };
}

/** Today's date in UTC (YYYY-MM-DD). */
export const todayUtc = () => new Date().toISOString().slice(0, 10);

/**
 * Other records that could be duplicates: same total, or an invoice number containing this one's normalized core.
 * The rules then apply the exact (normalized) match.
 */
export async function loadDuplicateCandidates(
  db: Db,
  orgId: string,
  record: Pick<RecordForValidation, "id" | "invoiceNumber" | "totalCents">,
): Promise<DuplicateCandidate[]> {
  const filters: string[] = [];
  if (record.totalCents != null) filters.push(`total_cents.eq.${record.totalCents}`);
  const core = normalizeInvoiceNumber(record.invoiceNumber)
    ?.replace(/^[A-Z]+/, "")
    .slice(-8);
  if (core && core.length >= 2) filters.push(`invoice_number.ilike.%${core}%`);
  if (filters.length === 0) return [];

  let query = db
    .from("records")
    .select("id, supplier_name, invoice_number, issue_date, total_cents, document:documents(file_name)")
    .eq("org_id", orgId)
    .or(filters.join(","))
    .limit(200);
  if (record.id) query = query.neq("id", record.id);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    supplierName: r.supplier_name,
    invoiceNumber: r.invoice_number,
    issueDate: r.issue_date,
    totalCents: r.total_cents,
    fileName: r.document?.file_name ?? null,
  }));
}

/** Other uploads of the exact same file (same sha256) in the org. */
export async function loadSameFile(db: Db, orgId: string, documentId: string | null, sha256: string | null) {
  if (!sha256) return [];
  let query = db
    .from("documents")
    .select("id, file_name")
    .eq("org_id", orgId)
    .eq("sha256", sha256)
    .neq("status", "uploading");
  if (documentId) query = query.neq("id", documentId);
  const { data, error } = await query.order("created_at").limit(20);
  if (error) throw error;
  return data.map((d) => ({ documentId: d.id, fileName: d.file_name }));
}

export async function loadOrgReviewSettings(db: Db, orgId: string) {
  const { data, error } = await db
    .from("organizations")
    .select("review_threshold, auto_approve")
    .eq("id", orgId)
    .single();
  if (error) throw error;
  return { threshold: Number(data.review_threshold), autoApprove: data.auto_approve };
}

/** Everything validateRecord needs besides the record itself. */
export async function loadValidationContext(
  db: Db,
  {
    orgId,
    record,
    documentId,
    sha256,
  }: { orgId: string; record: RecordForValidation; documentId: string | null; sha256: string | null },
): Promise<ValidationContext & { autoApprove: boolean }> {
  const [settings, candidates, sameFile] = await Promise.all([
    loadOrgReviewSettings(db, orgId),
    loadDuplicateCandidates(db, orgId, record),
    loadSameFile(db, orgId, documentId, sha256),
  ]);
  return {
    today: todayUtc(),
    threshold: settings.threshold,
    autoApprove: settings.autoApprove,
    candidates,
    sameFile,
  };
}
