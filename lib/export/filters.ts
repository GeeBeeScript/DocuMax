import { z } from "zod";
import { periodError } from "@/lib/calc/period";

/** Export query parameters (validated; invalid values are dropped, an invalid period is an error). */
const Schema = z.object({
  format: z.enum(["csv", "xlsx"]).catch("csv"),
  dataset: z.enum(["records", "lines"]).catch("records"),
  status: z.enum(["approved", "needs_review", "rejected", "all"]).catch("approved"),
  entity: z.uuid().optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
});
export type ExportFilters = z.infer<typeof Schema>;

export function parseExportFilters(params: URLSearchParams): {
  filters: ExportFilters;
  error: string | null;
} {
  const filters = Schema.parse(Object.fromEntries(params));
  const error =
    filters.from || filters.to ? periodError({ start: filters.from ?? "", end: filters.to ?? "" }) : null;
  return { filters, error };
}
