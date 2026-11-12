import "server-only";
import type { Period } from "@/lib/calc/period";
import type { StatementEntity, StatementRecord } from "@/lib/calc/statement";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Loading what lib/calc/statement.ts needs (RLS: members). Only approved records dated in the period are loaded;
 * for one entity that means records assigned to it plus records with an allocation to it.
 */

const RECORD_COLUMNS = `id, status, document_type, supplier_name, invoice_number, issue_date, currency, category, entity_id,
  tax_cents, total_cents, line_items(id, position, description, category, amount_cents),
  allocations(entity_id, line_item_id, method, percent_bp, amount_cents)`;
const CHUNK = 100;

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Row = NonNullable<Awaited<ReturnType<typeof baseQuery>>["data"]>[number];

function baseQuery(supabase: Client, orgId: string, period: Period) {
  return supabase
    .from("records")
    .select(RECORD_COLUMNS)
    .eq("org_id", orgId)
    .eq("status", "approved")
    .gte("issue_date", period.start)
    .lte("issue_date", period.end)
    .order("issue_date")
    .limit(5000);
}

function toStatementRecord(r: Row): StatementRecord {
  return {
    id: r.id,
    status: r.status,
    documentType: r.document_type,
    supplierName: r.supplier_name,
    invoiceNumber: r.invoice_number,
    issueDate: r.issue_date,
    currency: r.currency,
    category: r.category,
    entityId: r.entity_id,
    taxCents: r.tax_cents,
    totalCents: r.total_cents,
    lines: r.line_items.map((l) => ({
      id: l.id,
      position: l.position,
      description: l.description,
      category: l.category,
      amountCents: l.amount_cents,
    })),
    allocations: r.allocations.map((a) => ({
      entityId: a.entity_id,
      lineItemId: a.line_item_id,
      method: a.method,
      percentBp: a.percent_bp,
      amountCents: a.amount_cents,
    })),
  };
}

/** Approved records in the period: all of them, or those touching one entity. */
export async function loadStatementRecords(
  orgId: string,
  period: Period,
  entityId?: string,
): Promise<StatementRecord[]> {
  const supabase = await createSupabaseServerClient();
  if (!entityId) {
    const { data, error } = await baseQuery(supabase, orgId, period);
    if (error) throw error;
    return data.map(toStatementRecord);
  }
  const { data: allocs, error: allocError } = await supabase
    .from("allocations")
    .select("record_id")
    .eq("org_id", orgId)
    .eq("entity_id", entityId);
  if (allocError) throw allocError;
  const allocated = [...new Set(allocs.map((a) => a.record_id))];

  const own = await baseQuery(supabase, orgId, period).eq("entity_id", entityId);
  if (own.error) throw own.error;
  const byId = new Map(own.data.map((r) => [r.id, r]));
  for (let i = 0; i < allocated.length; i += CHUNK) {
    const { data, error } = await baseQuery(supabase, orgId, period).in("id", allocated.slice(i, i + CHUNK));
    if (error) throw error;
    for (const r of data) byId.set(r.id, r);
  }
  return [...byId.values()].map(toStatementRecord);
}

export async function getStatementEntity(orgId: string, entityId: string): Promise<StatementEntity | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("entities")
    .select("id, name, code, address, client_name, status")
    .eq("org_id", orgId)
    .eq("id", entityId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { id: data.id, name: data.name, code: data.code, address: data.address, clientName: data.client_name }
    : null;
}
