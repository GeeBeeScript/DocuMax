import { documentsCopy } from "@/content/app";
import type { EntityLabels } from "@/lib/entities/labels";
import type { StatementLine } from "@/lib/calc/statement";

/**
 * Export column definitions, shared by CSV and XLSX (and read back by the CSV import: headers here are the
 * import's default names). Values stay raw — money in cents, dates ISO — the writers format them.
 */

export type ColumnType = "text" | "money" | "date" | "datetime" | "number";

export interface ExportColumn<Row> {
  key: string;
  header: string;
  type: ColumnType;
  value: (row: Row) => string | number | null;
}

export interface ExportRecord {
  id: string;
  status: string;
  documentType: string | null;
  supplierName: string | null;
  supplierTaxId: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string | null;
  subtotalCents: number | null;
  taxCents: number | null;
  taxRate: string | null;
  totalCents: number | null;
  category: string | null;
  entityName: string | null;
  entityCode: string | null;
  fileName: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface ExportLine {
  recordId: string;
  invoiceNumber: string | null;
  supplierName: string | null;
  position: number;
  description: string | null;
  quantity: string | null;
  unitPriceCents: number | null;
  amountCents: number | null;
  category: string | null;
}

const categories = documentsCopy.record.categories as Record<string, string>;
const documentTypes = documentsCopy.record.documentTypes as Record<string, string>;
export const categoryLabel = (c: string | null) => (c ? (categories[c] ?? c) : null);
export const documentTypeLabel = (t: string | null) => (t ? (documentTypes[t] ?? t) : null);

/** The record columns; also the CSV import template (minus the read-only ones). */
export function recordColumns(
  labels: Pick<EntityLabels, "singular" | "fields">,
): ExportColumn<ExportRecord>[] {
  return [
    { key: "id", header: "Record ID", type: "text", value: (r) => r.id },
    { key: "status", header: "Status", type: "text", value: (r) => r.status.replace(/_/g, " ") },
    {
      key: "document_type",
      header: "Document type",
      type: "text",
      value: (r) => documentTypeLabel(r.documentType),
    },
    { key: "supplier_name", header: "Supplier", type: "text", value: (r) => r.supplierName },
    { key: "supplier_tax_id", header: "Supplier tax ID", type: "text", value: (r) => r.supplierTaxId },
    { key: "invoice_number", header: "Invoice number", type: "text", value: (r) => r.invoiceNumber },
    { key: "issue_date", header: "Issue date", type: "date", value: (r) => r.issueDate },
    { key: "due_date", header: "Due date", type: "date", value: (r) => r.dueDate },
    { key: "currency", header: "Currency", type: "text", value: (r) => r.currency },
    { key: "subtotal_cents", header: "Subtotal", type: "money", value: (r) => r.subtotalCents },
    { key: "tax_cents", header: "Tax", type: "money", value: (r) => r.taxCents },
    { key: "tax_rate", header: "Tax rate (%)", type: "number", value: (r) => r.taxRate },
    { key: "total_cents", header: "Total", type: "money", value: (r) => r.totalCents },
    { key: "category", header: "Category", type: "text", value: (r) => categoryLabel(r.category) },
    { key: "entity", header: labels.singular, type: "text", value: (r) => r.entityName },
    { key: "entity_code", header: labels.fields.code, type: "text", value: (r) => r.entityCode },
    { key: "file_name", header: "Source file", type: "text", value: (r) => r.fileName },
    { key: "approved_at", header: "Approved at", type: "datetime", value: (r) => r.approvedAt },
    { key: "created_at", header: "Created at", type: "datetime", value: (r) => r.createdAt },
  ];
}

export const lineColumns: ExportColumn<ExportLine>[] = [
  { key: "record_id", header: "Record ID", type: "text", value: (l) => l.recordId },
  { key: "invoice_number", header: "Invoice number", type: "text", value: (l) => l.invoiceNumber },
  { key: "supplier_name", header: "Supplier", type: "text", value: (l) => l.supplierName },
  { key: "position", header: "Line", type: "number", value: (l) => l.position },
  { key: "description", header: "Description", type: "text", value: (l) => l.description },
  { key: "quantity", header: "Quantity", type: "number", value: (l) => l.quantity },
  { key: "unit_price_cents", header: "Unit price", type: "money", value: (l) => l.unitPriceCents },
  { key: "amount_cents", header: "Amount", type: "money", value: (l) => l.amountCents },
  { key: "category", header: "Category", type: "text", value: (l) => categoryLabel(l.category) },
];

export const statementLineColumns: ExportColumn<StatementLine>[] = [
  { key: "date", header: "Date", type: "date", value: (l) => l.date },
  { key: "supplier", header: "Supplier", type: "text", value: (l) => l.supplier },
  { key: "invoice_number", header: "Invoice number", type: "text", value: (l) => l.invoiceNumber },
  { key: "description", header: "Description", type: "text", value: (l) => l.description },
  { key: "category", header: "Category", type: "text", value: (l) => categoryLabel(l.category) },
  { key: "net", header: "Before tax", type: "money", value: (l) => l.net },
  { key: "tax", header: "Tax", type: "money", value: (l) => l.tax },
  { key: "gross", header: "Total", type: "money", value: (l) => l.gross },
  { key: "shared", header: "Shared", type: "text", value: (l) => (l.split ? "yes" : "no") },
];
