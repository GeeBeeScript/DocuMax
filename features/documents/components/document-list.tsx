"use client";

import { useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { LiveRegion } from "@/components/app/live-region";
import { StatusBadge } from "@/components/app/status-badge";
import { documentsCopy } from "@/content/app";
import { DOCUMENT_STATUS_META } from "@/lib/documents/status";
import { formatBytes } from "@/lib/documents/upload-rules";
import { useDocumentStatuses } from "../hooks/use-document-status";
import { useThrottledRefresh } from "../hooks/use-throttled-refresh";
import type { DocumentRow } from "../queries";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Documents table with statuses that update live (Realtime) and are announced to screen readers. */
export function DocumentList({
  orgId,
  documents,
  entityHeader,
}: {
  orgId: string;
  documents: DocumentRow[];
  entityHeader: string;
}) {
  const [announcement, setAnnouncement] = useState("");
  const refresh = useThrottledRefresh();
  const names = Object.fromEntries(documents.map((d) => [d.id, d.fileName]));
  const statuses = useDocumentStatuses(
    orgId,
    Object.fromEntries(
      documents.map((d) => [d.id, { status: d.status, error: null, updatedAt: d.updatedAt }]),
    ),
    (id, next) => {
      if (names[id]) setAnnouncement(documentsCopy.live(names[id], DOCUMENT_STATUS_META[next.status].label));
      // Extraction can assign the property/job: re-fetch rows when a document leaves the AI stage.
      if (["validating", "ready", "needs_review", "failed"].includes(next.status)) refresh();
    },
  );
  const { columns } = documentsCopy.list;

  return (
    <>
      <LiveRegion message={announcement} />
      <DataTable
        caption={documentsCopy.list.caption}
        rows={documents}
        getRowKey={(d) => d.id}
        columns={[
          {
            key: "name",
            header: columns.name,
            rowHeader: true,
            className: "max-w-xs",
            cell: (d) => (
              <Link href={`/app/documents/${d.id}`} className="block truncate hover:underline">
                {d.fileName}
              </Link>
            ),
          },
          { key: "entity", header: entityHeader, hideOnMobile: true, cell: (d) => d.entityName ?? "—" },
          {
            key: "uploaded",
            header: columns.uploaded,
            hideOnMobile: true,
            className: "whitespace-nowrap",
            cell: (d) => dateFormat.format(new Date(d.createdAt)),
          },
          {
            key: "size",
            header: columns.size,
            align: "right",
            hideOnMobile: true,
            className: "tabular-nums",
            cell: (d) => formatBytes(d.sizeBytes),
          },
          {
            key: "status",
            header: columns.status,
            align: "right",
            cell: (d) => <StatusBadge status={statuses[d.id]?.status ?? d.status} />,
          },
        ]}
      />
    </>
  );
}
