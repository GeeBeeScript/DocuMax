import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ExportLine, ExportRecord } from "./columns";
import type { ExportFilters } from "./filters";

/** Records (+ their line items) for export. Every query filters by org_id; with the user's client RLS applies too. */

export const EXPORT_LIMIT = 20_000;

export async function loadExportData(
  db: SupabaseClient<Database>,
  orgId: string,
  filters: Pick<ExportFilters, "status" | "entity" | "from" | "to">,
): Promise<{ records: ExportRecord[]; lines: ExportLine[] }> {
  let query = db
    .from("records")
    .select(
      `id, status, document_type, supplier_name, supplier_tax_id, invoice_number, issue_date, due_date, currency,
       subtotal_cents, tax_cents, tax_rate, total_cents, category, approved_at, created_at,
       entity:entities(name, code), document:documents(file_name),
       line_items(position, description, quantity, unit_price_cents, amount_cents, category)`,
    )
    .eq("org_id", orgId)
    .order("issue_date", { ascending: true, nullsFirst: false })
    .order("created_at")
    .limit(EXPORT_LIMIT);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.entity) query = query.eq("entity_id", filters.entity);
  if (filters.from) query = query.gte("issue_date", filters.from);
  if (filters.to) query = query.lte("issue_date", filters.to);
  const { data, error } = await query;
  if (error) throw error;

  const records: ExportRecord[] = data.map((r) => ({
    id: r.id,
    status: r.status,
    documentType: r.document_type,
    supplierName: r.supplier_name,
    supplierTaxId: r.supplier_tax_id,
    invoiceNumber: r.invoice_number,
    issueDate: r.issue_date,
    dueDate: r.due_date,
    currency: r.currency,
    subtotalCents: r.subtotal_cents,
    taxCents: r.tax_cents,
    taxRate: r.tax_rate == null ? null : String(Number(r.tax_rate)),
    totalCents: r.total_cents,
    category: r.category,
    entityName: r.entity?.name ?? null,
    entityCode: r.entity?.code ?? null,
    fileName: r.document?.file_name ?? null,
    approvedAt: r.approved_at,
    createdAt: r.created_at,
  }));
  const lines: ExportLine[] = data.flatMap((r) =>
    [...r.line_items]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        recordId: r.id,
        invoiceNumber: r.invoice_number,
        supplierName: r.supplier_name,
        position: l.position,
        description: l.description,
        quantity: l.quantity == null ? null : String(Number(l.quantity)),
        unitPriceCents: l.unit_price_cents,
        amountCents: l.amount_cents,
        category: l.category,
      })),
  );
  return { records, lines };
}
