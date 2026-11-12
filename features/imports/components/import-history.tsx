import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { ToneBadge } from "@/components/app/status-badge";
import { dataCopy } from "@/content/app";
import type { StatusTone } from "@/lib/documents/status";
import type { ImportRow } from "../queries";

const copy = dataCopy.history;
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
const TONES: Record<ImportRow["status"], StatusTone> = {
  uploaded: "neutral",
  queued: "neutral",
  processing: "progress",
  done: "success",
  failed: "danger",
};

/** Started imports: status, how many rows went in, the error report. */
export function ImportHistory({ imports }: { imports: readonly ImportRow[] }) {
  return (
    <DataTable
      caption={copy.caption}
      rows={imports}
      getRowKey={(i) => i.id}
      columns={[
        {
          key: "file",
          header: copy.columns.file,
          rowHeader: true,
          cell: (i) => (
            <span className="flex flex-col">
              <span className="max-w-72 truncate">{i.fileName}</span>
              {i.error && <span className="text-xs font-normal text-danger">{i.error}</span>}
            </span>
          ),
        },
        {
          key: "status",
          header: copy.columns.status,
          cell: (i) => <ToneBadge tone={TONES[i.status]} label={copy.status[i.status]} />,
        },
        {
          key: "result",
          header: copy.columns.result,
          cell: (i) =>
            i.status === "done" ? (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{copy.result(i.rowsOk, i.rowsFailed)}</span>
                {i.hasErrorReport && (
                  // A plain link: the route redirects to a signed Storage URL (a download).
                  <a
                    href={`/app/data/imports/${i.id}/errors`}
                    className="text-sm font-semibold underline-offset-2 hover:underline"
                  >
                    {copy.errorReport}
                  </a>
                )}
                {i.rowsOk > 0 && (
                  <Link
                    href="/app/review"
                    className="text-sm font-semibold underline-offset-2 hover:underline"
                  >
                    {copy.review}
                  </Link>
                )}
              </span>
            ) : null,
        },
        {
          key: "created",
          header: copy.columns.created,
          hideOnMobile: true,
          className: "whitespace-nowrap text-muted-foreground",
          cell: (i) => dateTime.format(new Date(i.createdAt)),
        },
      ]}
    />
  );
}
