import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type EntityStatus = Database["public"]["Enums"]["entity_status"];

export interface EntitySummary {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  clientName: string | null;
  status: EntityStatus;
  documentCount: number;
}

/** Entities of the org with their document counts (RLS: members only). */
export async function listEntities(orgId: string, status: EntityStatus = "active"): Promise<EntitySummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("entities")
    .select("id, name, code, address, client_name, status, documents(count)")
    .eq("org_id", orgId)
    .eq("status", status)
    .order("name");
  if (error) throw error;
  return data.map((e) => ({
    id: e.id,
    name: e.name,
    code: e.code,
    address: e.address,
    clientName: e.client_name,
    status: e.status,
    documentCount: e.documents[0]?.count ?? 0,
  }));
}

/** Active entities as select options (upload assignment, filters). */
export async function listEntityOptions(orgId: string): Promise<{ value: string; label: string }[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("entities")
    .select("id, name, code")
    .eq("org_id", orgId)
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data.map((e) => ({ value: e.id, label: e.code ? `${e.name} (${e.code})` : e.name }));
}
