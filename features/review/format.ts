import { documentsCopy, reviewCopy } from "@/content/app";
import { formatCents, type Cents } from "@/lib/calc/money";

/** Human wording for stored values in history and the audit log (pure). */

const f = documentsCopy.record.fields;

export function fieldLabel(key: string, entitySingular: string): string {
  const labels: Record<string, string> = {
    document_type: f.documentType,
    supplier_name: f.supplier,
    supplier_tax_id: f.taxId,
    invoice_number: f.invoiceNumber,
    issue_date: f.issueDate,
    due_date: f.dueDate,
    currency: f.currency,
    subtotal_cents: f.subtotal,
    tax_cents: f.tax,
    tax_rate: `${f.tax} %`,
    total_cents: f.total,
    category: f.category,
    entity_id: f.entity(entitySingular),
    line_items: reviewCopy.timeline.lineItems,
    ...reviewCopy.timeline.columnLabels,
  };
  return labels[key] ?? key.replace(/_/g, " ");
}

const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
/** Columns holding the id of an entity or a person — shown by name when `names` knows it. */
const ID_KEYS = new Set([
  "entity_id",
  "approved_by",
  "uploaded_by",
  "user_id",
  "invited_by",
  "resolved_by",
  "actor_id",
]);

export function formatValue(
  key: string,
  value: unknown,
  { currency, names }: { currency?: string | null; names?: ReadonlyMap<string, string> } = {},
): string {
  if (value == null || value === "") return reviewCopy.timeline.empty;
  if (ID_KEYS.has(key) && typeof value === "string") return names?.get(value) ?? value.slice(0, 8);
  if (key.endsWith("_at") && typeof value === "string" && !Number.isNaN(Date.parse(value)))
    return dateTime.format(new Date(value));
  if (key === "status" && typeof value === "string") return value.replace(/_/g, " ");
  if (key.endsWith("_cents") && typeof value === "number") {
    return formatCents(value as Cents, currency ?? "USD");
  }
  if (key === "line_items" && Array.isArray(value)) return reviewCopy.timeline.lineCount(value.length);
  if (key === "document_type" && typeof value === "string")
    return (
      documentsCopy.record.documentTypes[value as keyof typeof documentsCopy.record.documentTypes] ?? value
    );
  if (key === "category" && typeof value === "string")
    return documentsCopy.record.categories[value as keyof typeof documentsCopy.record.categories] ?? value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
