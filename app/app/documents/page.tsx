import type { Metadata } from "next";
import { FileStack } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { FormAlert } from "@/components/app/form-alert";
import { PageHeader } from "@/components/app/page-header";
import { documentsCopy } from "@/content/app";
import { DocumentList } from "@/features/documents/components/document-list";
import { UploadPanel } from "@/features/documents/components/upload-panel";
import { listDocuments } from "@/features/documents/queries";
import { getUsage } from "@/features/billing/queries";
import { PLANS } from "@/lib/billing/plans";
import { listEntityOptions } from "@/features/entities/queries";
import { canWrite, hasRole } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { entityLabels } from "@/lib/entities/labels";

export const metadata: Metadata = { title: documentsCopy.title };

export default async function DocumentsPage() {
  const ctx = await requireActiveOrg();
  const labels = entityLabels(ctx.org.entity_kind);
  const writer = canWrite(ctx.role);
  const [documents, entityOptions, usage] = await Promise.all([
    listDocuments(ctx.org.id),
    writer ? listEntityOptions(ctx.org.id) : Promise.resolve([]),
    getUsage(ctx.org.id),
  ]);
  const quota = {
    remaining: usage.documentsCap == null ? null : Math.max(usage.documentsCap - usage.documentsUsed, 0),
    cap: usage.documentsCap,
    planName: PLANS[usage.plan].name,
    canManageBilling: hasRole(ctx.role, ["owner"]),
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={documentsCopy.title} description={documentsCopy.description} />
      {writer ? (
        <UploadPanel entityOptions={entityOptions} entitySingular={labels.singular} quota={quota} />
      ) : (
        <FormAlert tone="info">{documentsCopy.list.readOnly}</FormAlert>
      )}
      {documents.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title={documentsCopy.list.empty.title}
          description={documentsCopy.list.empty.description}
        />
      ) : (
        <DocumentList orgId={ctx.org.id} documents={documents} entityHeader={labels.singular} />
      )}
    </div>
  );
}
