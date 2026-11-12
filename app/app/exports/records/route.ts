import { NextResponse, type NextRequest } from "next/server";
import { attachment, CSV_TYPE, withBom, XLSX_TYPE } from "@/lib/http/attachment";
import { requireActiveOrg } from "@/lib/auth/session";
import { todayIn } from "@/lib/calc/period";
import { entityLabels } from "@/lib/entities/labels";
import { lineColumns, recordColumns } from "@/lib/export/columns";
import { toCsv } from "@/lib/export/csv";
import { parseExportFilters } from "@/lib/export/filters";
import { loadExportData } from "@/lib/export/load";
import { toXlsx } from "@/lib/export/xlsx";
import { safeFileName } from "@/lib/reports/file-names";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /app/exports/records?format=csv|xlsx&dataset=records|lines&status=approved|…&entity=&from=&to=
 * The signed-in user's records (RLS), filtered. CSV holds one dataset; XLSX holds records + line items.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireActiveOrg();
  const { filters, error } = parseExportFilters(request.nextUrl.searchParams);
  if (error) return new NextResponse(error, { status: 400 });

  const { records, lines } = await loadExportData(await createSupabaseServerClient(), ctx.org.id, filters);
  const columns = recordColumns(entityLabels(ctx.org.entity_kind));
  const stamp = todayIn(ctx.org.timezone);

  if (filters.format === "xlsx") {
    const body = await toXlsx([
      { name: "Records", columns, rows: records },
      { name: "Line items", columns: lineColumns, rows: lines },
    ]);
    return attachment(body, `${safeFileName(`Records - ${stamp}`)}.xlsx`, XLSX_TYPE);
  }
  const csv = filters.dataset === "lines" ? toCsv(lineColumns, lines) : toCsv(columns, records);
  const name = filters.dataset === "lines" ? `Line items - ${stamp}` : `Records - ${stamp}`;
  return attachment(withBom(csv), `${safeFileName(name)}.csv`, CSV_TYPE);
}
