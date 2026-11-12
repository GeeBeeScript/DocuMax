import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import { isSystemActor } from "@/lib/audit/actors";
import type { AuditFilters } from "./filters";

const personName = (p: { full_name: string | null; email: string } | null) =>
  p?.full_name || p?.email || null;

/** Org-wide audit log (owners/admins — RLS returns nothing to others), newest first, keyset-paginated. */

export const AUDIT_PAGE_SIZE = 50;

export interface AuditEntry {
  id: number;
  tableName: string;
  rowId: string;
  action: Database["public"]["Enums"]["audit_action"];
  actorId: string | null;
  actorName: string | null;
  diff: Json | null;
  before: Json | null;
  after: Json | null;
  createdAt: string;
}

export async function listAuditLog(
  orgId: string,
  filters: AuditFilters,
): Promise<{ entries: AuditEntry[]; nextBefore: number | null }> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("audit_log")
    .select("id, table_name, row_id, action, actor_id, diff, before, after, created_at")
    .eq("org_id", orgId)
    .order("id", { ascending: false })
    .limit(AUDIT_PAGE_SIZE + 1);
  if (filters.table) query = query.eq("table_name", filters.table);
  if (filters.actor) query = query.eq("actor_id", filters.actor);
  if (filters.before) query = query.lt("id", filters.before);
  const { data, error } = await query;
  if (error) throw error;

  const page = data.slice(0, AUDIT_PAGE_SIZE);
  const actorIds = [...new Set(page.map((e) => e.actor_id).filter((id): id is string => !isSystemActor(id)))];
  const { data: people } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, personName(p)]));

  return {
    entries: page.map((e) => ({
      id: e.id,
      tableName: e.table_name,
      rowId: e.row_id,
      action: e.action,
      actorId: isSystemActor(e.actor_id) ? null : e.actor_id,
      actorName: e.actor_id ? (names.get(e.actor_id) ?? null) : null,
      diff: e.diff,
      before: e.before,
      after: e.after,
      createdAt: e.created_at,
    })),
    nextBefore: data.length > AUDIT_PAGE_SIZE ? page.at(-1)!.id : null,
  };
}
