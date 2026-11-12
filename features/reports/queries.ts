import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];

export interface ReportRow {
  id: string;
  kind: Enums["report_kind"];
  fileName: string;
  periodStart: string;
  periodEnd: string;
  status: Enums["report_status"];
  error: string | null;
  pageCount: number | null;
  entityName: string | null;
  batchId: string | null;
  createdAt: string;
}

export interface BatchRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: Enums["batch_status"];
  total: number;
  completed: number;
  failed: number;
  error: string | null;
  createdAt: string;
}

/** Recent reports (RLS: members). */
export async function listReports(orgId: string, limit = 100): Promise<ReportRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, kind, file_name, period_start, period_end, status, error, page_count, batch_id, created_at, entity:entities(name)",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    kind: r.kind,
    fileName: r.file_name,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    status: r.status,
    error: r.error,
    pageCount: r.page_count,
    entityName: r.entity?.name ?? null,
    batchId: r.batch_id,
    createdAt: r.created_at,
  }));
}

/** Recent batches (RLS: members). */
export async function listBatches(orgId: string, limit = 5): Promise<BatchRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("report_batches")
    .select("id, period_start, period_end, status, total, completed, failed, error, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((b) => ({
    id: b.id,
    periodStart: b.period_start,
    periodEnd: b.period_end,
    status: b.status,
    total: b.total,
    completed: b.completed,
    failed: b.failed,
    error: b.error,
    createdAt: b.created_at,
  }));
}
