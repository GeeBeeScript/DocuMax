import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export interface ImportRow {
  id: string;
  fileName: string;
  status: Database["public"]["Enums"]["import_status"];
  rowsTotal: number;
  rowsOk: number;
  rowsFailed: number;
  hasErrorReport: boolean;
  error: string | null;
  createdAt: string;
}

/** Recent imports that were started (RLS: members). */
export async function listImports(orgId: string, limit = 20): Promise<ImportRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("imports")
    .select("id, file_name, status, rows_total, rows_ok, rows_failed, error_report_path, error, created_at")
    .eq("org_id", orgId)
    .neq("status", "uploaded")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((i) => ({
    id: i.id,
    fileName: i.file_name,
    status: i.status,
    rowsTotal: i.rows_total,
    rowsOk: i.rows_ok,
    rowsFailed: i.rows_failed,
    hasErrorReport: !!i.error_report_path,
    error: i.error,
    createdAt: i.created_at,
  }));
}
