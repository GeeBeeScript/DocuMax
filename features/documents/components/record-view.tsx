import type { ReactNode } from "react";
import { ClipboardCheck, Sparkles } from "lucide-react";
import { ConfidencePill } from "@/components/app/confidence-pill";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { FormAlert } from "@/components/app/form-alert";
import { Money } from "@/components/app/money";
import { PillButton } from "@/components/brand/pill-button";
import { documentsCopy } from "@/content/app";
import type { DocumentRecord } from "../queries";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const formatDate = (iso: string | null) => (iso ? dateFormat.format(new Date(`${iso}T00:00:00Z`)) : null);

/** Read-only view of the AI-extracted record: fields with confidence, then line items. */
export function RecordView({
  data,
  entitySingular,
  threshold,
}: {
  data: DocumentRecord | null;
  entitySingular: string;
  threshold: number;
}) {
  const copy = documentsCopy.record;
  if (!data)
    return <EmptyState icon={Sparkles} title={copy.pending.title} description={copy.pending.description} />;

  const { record: r, lineItems, entityName } = data;
  const conf = r.field_confidence as Record<string, number>;
  const empty = <span className="text-muted-foreground">—</span>;
  const f = copy.fields;

  const rows: { key: string; label: string; value: ReactNode; confidenceKey?: string }[] = [
    { key: "supplier", label: f.supplier, value: r.supplier_name ?? empty, confidenceKey: "supplier_name" },
    { key: "taxId", label: f.taxId, value: r.supplier_tax_id ?? empty, confidenceKey: "supplier_tax_id" },
    {
      key: "documentType",
      label: f.documentType,
      value: r.document_type ? copy.documentTypes[r.document_type] : empty,
      confidenceKey: "document_type",
    },
    {
      key: "invoiceNumber",
      label: f.invoiceNumber,
      value: r.invoice_number ?? empty,
      confidenceKey: "invoice_number",
    },
    {
      key: "issueDate",
      label: f.issueDate,
      value: formatDate(r.issue_date) ?? empty,
      confidenceKey: "issue_date",
    },
    { key: "dueDate", label: f.dueDate, value: formatDate(r.due_date) ?? empty, confidenceKey: "due_date" },
    { key: "currency", label: f.currency, value: r.currency ?? empty, confidenceKey: "currency" },
    {
      key: "subtotal",
      label: f.subtotal,
      value: <Money value={r.subtotal_cents} currency={r.currency} />,
      confidenceKey: "subtotal_cents",
    },
    {
      key: "tax",
      label: r.tax_rate != null ? `${f.tax} (${Number(r.tax_rate)}%)` : f.tax,
      value: <Money value={r.tax_cents} currency={r.currency} />,
      confidenceKey: "tax_cents",
    },
    {
      key: "total",
      label: f.total,
      value: <Money value={r.total_cents} currency={r.currency} className="font-bold" />,
      confidenceKey: "total_cents",
    },
    {
      key: "category",
      label: f.category,
      value: r.category ? copy.categories[r.category] : empty,
      confidenceKey: "category",
    },
    { key: "entity", label: f.entity(entitySingular), value: entityName ?? empty, confidenceKey: "entity" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <FormAlert tone="info" className="flex-1">
          {copy.readOnlyNote}
        </FormAlert>
        <PillButton href={`/app/review/${r.id}`} variant="outline" size="sm">
          <ClipboardCheck aria-hidden /> {copy.openInReview}
        </PillButton>
      </div>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-col gap-1 border-b border-gray-100 pb-3">
            <dt className="flex items-center justify-between gap-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
              <span>{row.label}</span>
              {row.confidenceKey && conf[row.confidenceKey] != null && (
                <ConfidencePill score={conf[row.confidenceKey]} threshold={threshold} />
              )}
            </dt>
            <dd className="text-sm break-words text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {copy.lowestConfidence}: <ConfidencePill score={Number(r.min_confidence)} threshold={threshold} />
      </p>
      {lineItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.noLines}</p>
      ) : (
        <DataTable
          caption={copy.lines.caption}
          rows={lineItems}
          getRowKey={(l) => l.id}
          columns={[
            {
              key: "description",
              header: copy.lines.description,
              rowHeader: true,
              cell: (l) => l.description ?? "—",
            },
            {
              key: "qty",
              header: copy.lines.quantity,
              align: "right",
              hideOnMobile: true,
              className: "tabular-nums",
              cell: (l) => (l.quantity == null ? "—" : Number(l.quantity)),
            },
            {
              key: "unit",
              header: copy.lines.unitPrice,
              align: "right",
              hideOnMobile: true,
              cell: (l) => <Money value={l.unit_price_cents} currency={r.currency} />,
            },
            {
              key: "amount",
              header: copy.lines.amount,
              align: "right",
              cell: (l) => <Money value={l.amount_cents} currency={r.currency} />,
            },
            {
              key: "category",
              header: copy.lines.category,
              hideOnMobile: true,
              cell: (l) => (l.category ? copy.categories[l.category] : "—"),
            },
            {
              key: "confidence",
              header: copy.lines.confidence,
              align: "right",
              cell: (l) => <ConfidencePill score={Number(l.confidence)} threshold={threshold} />,
            },
          ]}
        />
      )}
    </div>
  );
}
