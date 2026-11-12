import { requireActiveOrg } from "@/lib/auth/session";
import { entityLabels } from "@/lib/entities/labels";
import { recordColumns, type ExportRecord } from "@/lib/export/columns";
import { toCsv } from "@/lib/export/csv";
import { attachment, CSV_TYPE, withBom } from "@/lib/http/attachment";

/** A CSV template: the importable columns (same headers as the export) and one example row. */
const READ_ONLY = new Set(["id", "status", "file_name", "approved_at", "created_at"]);

export async function GET() {
  const ctx = await requireActiveOrg();
  const columns = recordColumns(entityLabels(ctx.org.entity_kind)).filter((c) => !READ_ONLY.has(c.key));
  const example: ExportRecord = {
    id: "",
    status: "needs_review",
    documentType: "invoice",
    supplierName: "Brightline Plumbing Co.",
    supplierTaxId: "47-2291034",
    invoiceNumber: "INV-2041",
    issueDate: "2026-10-14",
    dueDate: "2026-11-13",
    currency: ctx.org.default_currency,
    subtotalCents: 116450,
    taxCents: 9607,
    taxRate: "8.25",
    totalCents: 126057,
    category: "repairs_maintenance",
    entityName: null,
    entityCode: null,
    fileName: null,
    approvedAt: null,
    createdAt: "",
  };
  return attachment(withBom(toCsv(columns, [example])), "DocuMax import template.csv", CSV_TYPE);
}
