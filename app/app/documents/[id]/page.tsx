import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { DocumentPreview } from "@/components/app/document-preview";
import { PageHeader } from "@/components/app/page-header";
import { PillButton } from "@/components/brand/pill-button";
import { documentsCopy } from "@/content/app";
import { DocumentStatusPanel } from "@/features/documents/components/document-status-panel";
import { getDocument } from "@/features/documents/queries";
import { canWrite } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { formatBytes } from "@/lib/documents/upload-rules";
import { entityLabels } from "@/lib/entities/labels";

export const metadata: Metadata = { title: "Document" };

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireActiveOrg();
  const doc = /^[0-9a-f-]{36}$/i.test(id) ? await getDocument(ctx.org.id, id) : null;
  if (!doc) notFound();
  const labels = entityLabels(ctx.org.entity_kind);
  const { facts } = documentsCopy.detail;

  const rows: [string, string][] = [
    [labels.singular, doc.entityName ?? "—"],
    [
      facts.uploaded,
      `${dateFormat.format(new Date(doc.createdAt))}${doc.uploaderName ? ` · ${doc.uploaderName}` : ""}`,
    ],
    [facts.size, formatBytes(doc.sizeBytes)],
    ...(doc.pageCount ? ([[facts.pages, String(doc.pageCount)]] as [string, string][]) : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PillButton href="/app/documents" variant="ghost" size="sm" className="self-start">
        <ArrowLeft aria-hidden /> {documentsCopy.detail.back}
      </PillButton>
      <PageHeader
        title={<span className="break-all">{doc.fileName}</span>}
        actions={
          doc.fileUrl && (
            <PillButton
              href={doc.fileUrl}
              variant="outline"
              size="sm"
              target="_blank"
              rel="noopener"
              download={doc.fileName}
            >
              <Download aria-hidden /> {documentsCopy.detail.download}
            </PillButton>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section
          aria-label={doc.fileName}
          className="order-2 min-w-0 rounded-2xl border border-gray-200 bg-paper p-4 lg:order-1"
        >
          <DocumentPreview
            url={doc.fileUrl}
            mimeType={doc.mimeType}
            fileName={doc.fileName}
            labels={documentsCopy.preview}
          />
        </section>
        <aside className="order-1 flex flex-col gap-5 rounded-2xl border border-gray-200 bg-paper p-5 lg:order-2">
          <DocumentStatusPanel
            orgId={ctx.org.id}
            documentId={doc.id}
            fileName={doc.fileName}
            initialStatus={doc.status}
            initialError={doc.error}
            canRetry={canWrite(ctx.role)}
          />
          <dl className="flex flex-col gap-3 text-sm">
            {rows.map(([term, value]) => (
              <div key={term} className="flex flex-col gap-0.5">
                <dt className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}
