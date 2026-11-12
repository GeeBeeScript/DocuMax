import Link from "next/link";
import { ConfidencePill } from "@/components/app/confidence-pill";
import { DataTable } from "@/components/app/data-table";
import { Money } from "@/components/app/money";
import { reviewCopy } from "@/content/app";
import type { QueueItem } from "../queries";
import { IssueChips } from "./issue-chips";

const copy = reviewCopy.queue;

/** The review queue, oldest first. Each row opens the review screen with the same filters (so J/K follow them). */
export function ReviewQueueTable({
  items,
  query,
  threshold,
  entitySingular,
}: {
  items: readonly QueueItem[];
  /** Current filters as a query string, carried to the review screen. */
  query: string;
  threshold: number;
  entitySingular: string;
}) {
  return (
    <DataTable
      caption={copy.caption}
      rows={items}
      getRowKey={(r) => r.id}
      columns={[
        {
          key: "document",
          header: copy.columns.document,
          rowHeader: true,
          cell: (r) => (
            <Link
              href={`/app/review/${r.id}${query}`}
              className="block max-w-64 truncate underline-offset-2 hover:underline"
            >
              {r.fileName ?? r.invoiceNumber ?? r.id.slice(0, 8)}
            </Link>
          ),
        },
        {
          key: "supplier",
          header: copy.columns.supplier,
          cell: (r) => r.supplierName ?? <span className="text-muted-foreground">—</span>,
        },
        {
          key: "entity",
          header: copy.columns.entity(entitySingular),
          hideOnMobile: true,
          cell: (r) => r.entityName ?? <span className="text-muted-foreground">—</span>,
        },
        {
          key: "total",
          header: copy.columns.total,
          align: "right",
          cell: (r) => <Money value={r.totalCents} currency={r.currency} />,
        },
        {
          key: "confidence",
          header: copy.columns.confidence,
          align: "right",
          hideOnMobile: true,
          cell: (r) => <ConfidencePill score={r.minConfidence} threshold={threshold} />,
        },
        { key: "issues", header: copy.columns.issues, cell: (r) => <IssueChips issues={r.issues} /> },
      ]}
    />
  );
}
