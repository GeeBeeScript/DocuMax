import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];

/** Tables with an `org_id` column (organizations itself is scoped by `id`). */
export type TenantTable = {
  [K in keyof Tables]: Tables[K]["Row"] extends { org_id: string } ? K : never;
}[keyof Tables];

export class OrgScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrgScopeError";
  }
}

/**
 * Org-scoped repository for the SERVICE-ROLE client (worker, webhooks, tests), which bypasses RLS.
 * Every read/update/delete is pre-filtered by `org_id`, inserts get `org_id` stamped, and `requireRow`
 * verifies a target row belongs to the org before any work is done (docs/MULTI_TENANCY.md → service role rules).
 *
 * The client is passed in (not created here) so this module stays free of env/server-only imports.
 */
export function forOrg(client: SupabaseClient<Database>, orgId: string) {
  const id = z.uuid().parse(orgId);
  // supabase-js can't narrow column names through a generic table parameter, so queries run on an untyped
  // view of the client; the public signatures below stay typed.
  const db = client as unknown as SupabaseClient;

  function assertOwned<R extends { org_id?: unknown }>(rows: R[] | null): R[] {
    for (const row of rows ?? []) {
      if (row.org_id !== id) throw new OrgScopeError(`Row belongs to another organization (expected ${id})`);
    }
    return rows ?? [];
  }

  return {
    orgId: id,
    assertOwned,

    select<T extends TenantTable>(table: T, columns = "*") {
      return db.from(table).select(columns).eq("org_id", id);
    },

    insert<T extends TenantTable>(table: T, rows: Omit<Tables[T]["Insert"], "org_id">[]) {
      return db.from(table).insert(rows.map((r) => ({ ...r, org_id: id })));
    },

    update<T extends TenantTable>(table: T, values: Omit<Tables[T]["Update"], "org_id">) {
      return db.from(table).update(values).eq("org_id", id);
    },

    delete<T extends TenantTable>(table: T) {
      return db.from(table).delete().eq("org_id", id);
    },

    /**
     * Loads a row by primary key WITHOUT the org filter and throws unless it belongs to this org. Use before
     * acting on an id that came from a job payload — a mismatch means a bug or a tampered payload.
     */
    async requireRow<T extends TenantTable>(table: T, rowId: string): Promise<Tables[T]["Row"]> {
      const { data, error } = await db.from(table).select("*").eq("id", rowId).maybeSingle();
      if (error) throw error;
      if (!data) throw new OrgScopeError(`${String(table)} ${rowId} not found`);
      return assertOwned([data as { org_id?: unknown }])[0] as Tables[T]["Row"];
    },
  };
}

export type OrgScope = ReturnType<typeof forOrg>;
