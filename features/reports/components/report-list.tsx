import { Download } from "lucide-react";
import { DataTable } from "@/components/app/data-table";
import { ToneBadge } from "@/components/app/status-badge";
import { reportsCopy } from "@/content/app";
import { periodLabel } from "@/lib/calc/period";
import type { StatusTone } from "@/lib/documents/status";
import type { BatchRow, ReportRow } from "../queries";

const copy = reportsCopy;
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export const REPORT_TONES: Record<ReportRow["status"], StatusTone> = {
  queued: "neutral",
  rendering: "progress",
  ready: "success",
  failed: "danger",
};
const BATCH_TONES: Record<BatchRow["status"], StatusTone> = {
  running: "progress",
  zipping: "progress",
  ready: "success",
  failed: "danger",
};

/** Generated reports with live status and a download link once ready. */
export function ReportList({ reports }: { reports: readonly ReportRow[] }) {
  return (
    <DataTable
      caption={copy.caption}
      rows={reports}
      getRowKey={(r) => r.id}
      columns={[
        {
          key: "name",
          header: copy.columns.name,
          rowHeader: true,
          cell: (r) => (
            <span className="flex flex-col">
              <span className="max-w-80 truncate">{r.fileName}</span>
              {r.status === "failed" && r.error && (
                <span className="text-xs font-normal text-danger">{r.error}</span>
              )}
            </span>
          ),
        },
        { key: "kind", header: copy.columns.kind, hideOnMobile: true, cell: (r) => copy.kinds[r.kind] },
        {
          key: "period",
          header: copy.columns.period,
          hideOnMobile: true,
          cell: (r) => periodLabel({ start: r.periodStart, end: r.periodEnd }),
        },
        {
          key: "status",
          header: copy.columns.status,
          cell: (r) => <ToneBadge tone={REPORT_TONES[r.status]} label={copy.status[r.status]} />,
        },
        {
          key: "created",
          header: copy.columns.created,
          hideOnMobile: true,
          className: "whitespace-nowrap text-muted-foreground",
          cell: (r) => dateTime.format(new Date(r.createdAt)),
        },
        {
          key: "download",
          header: <span className="sr-only">{copy.columns.download}</span>,
          align: "right",
          cell: (r) =>
            r.status === "ready" ? (
              // A plain link: the route redirects to a signed Storage URL (a file download, not a page).
              <a
                href={`/app/reports/${r.id}/download`}
                className="inline-flex items-center gap-1.5 font-semibold underline-offset-2 hover:underline"
                aria-label={`${copy.download} ${r.fileName}`}
              >
                <Download className="size-4" aria-hidden /> {copy.download}
              </a>
            ) : null,
        },
      ]}
    />
  );
}

/** Recent statement batches: progress, then the ZIP. */
export function BatchList({ batches }: { batches: readonly BatchRow[] }) {
  return (
    <ul className="flex flex-col gap-2" aria-label={copy.batches.title}>
      {batches.map((b) => {
        const done = b.completed + b.failed;
        const pct = b.total ? Math.round((done / b.total) * 100) : 0;
        return (
          <li
            key={b.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-paper px-4 py-3"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="text-sm font-semibold">
                {copy.batches.label(periodLabel({ start: b.periodStart, end: b.periodEnd }))}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div
                  className="h-1.5 w-40 overflow-hidden rounded-full bg-gray-100"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={b.total}
                  aria-valuenow={done}
                  aria-label={copy.batches.progress(done, b.total)}
                >
                  <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
                </div>
                <span>{copy.batches.progress(b.completed, b.total)}</span>
                {b.failed > 0 && <span className="text-danger">{copy.batches.failed(b.failed)}</span>}
              </div>
            </div>
            <ToneBadge tone={BATCH_TONES[b.status]} label={copy.batchStatus[b.status]} />
            {b.status === "ready" && (
              <a
                href={`/app/reports/batches/${b.id}/download`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-2 hover:underline"
              >
                <Download className="size-4" aria-hidden /> {copy.downloadZip}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
