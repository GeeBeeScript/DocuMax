import "server-only";
import type { Period } from "@/lib/calc/period";
import type { StatementEntity, StatementRecord } from "@/lib/calc/statement";
import * as load from "@/lib/statements/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The signed-in user's view (RLS) of lib/statements/load.ts. */

export async function loadStatementRecords(
  orgId: string,
  period: Period,
  entityId?: string,
): Promise<StatementRecord[]> {
  return load.loadStatementRecords(await createSupabaseServerClient(), orgId, period, entityId);
}

export async function getStatementEntity(orgId: string, entityId: string): Promise<StatementEntity | null> {
  return load.getStatementEntity(await createSupabaseServerClient(), orgId, entityId);
}

export async function listStatementEntities(orgId: string): Promise<StatementEntity[]> {
  return load.listStatementEntities(await createSupabaseServerClient(), orgId);
}
