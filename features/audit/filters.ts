import { z } from "zod";

/** Tables whose changes are audited (docs/DATA_MODEL.md). */
export const AUDITED_TABLES = [
  "organizations",
  "memberships",
  "invites",
  "entities",
  "documents",
  "records",
  "line_items",
] as const;

const AuditFiltersSchema = z.object({
  table: z.enum(AUDITED_TABLES).optional().catch(undefined),
  actor: z.uuid().optional().catch(undefined),
  before: z.coerce.number().int().positive().optional().catch(undefined),
});
export type AuditFilters = z.infer<typeof AuditFiltersSchema>;

export function parseAuditFilters(params: Record<string, string | string[] | undefined>): AuditFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const parsed = AuditFiltersSchema.parse({
    table: first(params.table),
    actor: first(params.actor),
    before: first(params.before),
  });
  return Object.fromEntries(Object.entries(parsed).filter(([, v]) => v != null)) as AuditFilters;
}

export function auditQueryString(filters: AuditFilters): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v != null) params.set(k, String(v));
  const s = params.toString();
  return s ? `?${s}` : "";
}
