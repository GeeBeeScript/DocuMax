import { NextResponse, type NextRequest } from "next/server";
import { parsePeriodParams } from "@/features/statements/period-params";
import { getStatementEntity, loadStatementRecords } from "@/features/statements/queries";
import { requireActiveOrg } from "@/lib/auth/session";
import { formatBp } from "@/lib/calc/allocate";
import { buildStatement, type CategoryRow } from "@/lib/calc/statement";
import { categoryLabel, statementLineColumns, type ExportColumn } from "@/lib/export/columns";
import { toCsv } from "@/lib/export/csv";
import { toXlsx } from "@/lib/export/xlsx";
import { attachment, CSV_TYPE, withBom, XLSX_TYPE } from "@/lib/http/attachment";
import { periodSlug, safeFileName } from "@/lib/reports/file-names";

/**
 * GET /app/exports/statement?entity=…&month=2026-10 (or from/to)&format=csv|xlsx — the same figures as the
 * statement (lib/calc buildStatement). CSV: the cost lines; XLSX: summary, categories and cost lines.
 */
const categoryColumns: ExportColumn<CategoryRow>[] = [
  {
    key: "category",
    header: "Category",
    type: "text",
    value: (c) => categoryLabel(c.category) ?? "Uncategorized",
  },
  { key: "net", header: "Before tax", type: "money", value: (c) => c.net },
  { key: "tax", header: "Tax", type: "money", value: (c) => c.tax },
  { key: "gross", header: "Total", type: "money", value: (c) => c.gross },
  { key: "share", header: "Share (%)", type: "number", value: (c) => formatBp(c.shareBp) },
];

export async function GET(request: NextRequest) {
  const ctx = await requireActiveOrg();
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const entityId = params.entity;
  if (!entityId || !/^[0-9a-f-]{36}$/i.test(entityId)) return new NextResponse("Not found", { status: 404 });
  const selection = parsePeriodParams(params, ctx.org.timezone);
  if (selection.error) return new NextResponse(selection.error, { status: 400 });
  const entity = await getStatementEntity(ctx.org.id, entityId);
  if (!entity) return new NextResponse("Not found", { status: 404 });

  const data = buildStatement({
    org: { name: ctx.org.name },
    entity,
    period: selection.period,
    currency: ctx.org.default_currency,
    records: await loadStatementRecords(ctx.org.id, selection.period, entity.id),
    generatedAt: new Date().toISOString(),
  });
  const name = safeFileName(`Statement data - ${entity.name} - ${periodSlug(selection.period)}`);

  if (params.format === "xlsx") {
    const summary: ExportColumn<[string, number | string]>[] = [
      { key: "item", header: "Item", type: "text", value: (r) => r[0] },
      { key: "value", header: "Value", type: "text", value: (r) => String(r[1]) },
    ];
    const money: ExportColumn<[string, number]>[] = [
      { key: "item", header: "Figure", type: "text", value: (r) => r[0] },
      { key: "value", header: `Amount (${data.currency})`, type: "money", value: (r) => r[1] },
    ];
    const body = await toXlsx([
      {
        name: "Summary",
        columns: summary,
        rows: [
          ["Property or job", entity.name],
          ["Period", data.period.label],
          ["Records", data.summary.records],
        ],
      },
      {
        name: "Totals",
        columns: money,
        rows: [
          ["Before tax", data.summary.net],
          ["Tax", data.summary.tax],
          ["Total", data.summary.gross],
        ],
      },
      { name: "Categories", columns: categoryColumns, rows: data.categories },
      { name: "Costs", columns: statementLineColumns, rows: data.lines },
    ]);
    return attachment(body, `${name}.xlsx`, XLSX_TYPE);
  }
  return attachment(withBom(toCsv(statementLineColumns, data.lines)), `${name}.csv`, CSV_TYPE);
}
