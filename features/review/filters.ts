import { z } from "zod";
import { ISSUE_CODES } from "@/lib/validation/types";

/**
 * Review queue filters live in the URL (shareable, back-button friendly). Parsed leniently: an invalid value is
 * dropped rather than failing the page.
 */
export const QueueFiltersSchema = z.object({
  issue: z
    .enum([...ISSUE_CODES, "clean"])
    .optional()
    .catch(undefined),
  entity: z.uuid().optional().catch(undefined),
  supplier: z.string().trim().max(100).optional().catch(undefined),
  confidence: z.enum(["low", "ok"]).optional().catch(undefined),
});
export type QueueFilters = z.infer<typeof QueueFiltersSchema>;

type SearchParams = Record<string, string | string[] | undefined>;

export function parseQueueFilters(params: SearchParams): QueueFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const parsed = QueueFiltersSchema.parse({
    issue: first(params.issue),
    entity: first(params.entity),
    supplier: first(params.supplier),
    confidence: first(params.confidence),
  });
  return Object.fromEntries(Object.entries(parsed).filter(([, v]) => v)) as QueueFilters;
}

/** `?issue=…&entity=…` (empty string when there are no filters) — kept on review links so J/K follow the same list. */
export function queueQueryString(filters: QueueFilters, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filters, ...extra })) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : "";
}
