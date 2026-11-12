import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allocationCopy, reviewCopy } from "@/content/app";
import { AllocationEditor } from "@/features/allocations/components/allocation-editor";
import { DocumentViewer } from "@/features/documents/components/document-viewer";
import { listEntityOptions } from "@/features/entities/queries";
import { RecordTimeline } from "@/features/review/components/record-timeline";
import { ReviewWorkspace } from "@/features/review/components/review-workspace";
import { parseQueueFilters, queueQueryString } from "@/features/review/filters";
import { getReviewItem } from "@/features/review/queries";
import { canReview } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { entityLabels } from "@/lib/entities/labels";

export const metadata: Metadata = { title: reviewCopy.title };

export default async function ReviewItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, rawParams] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireActiveOrg();
  const filters = parseQueueFilters(rawParams);
  const threshold = Number(ctx.org.review_threshold);
  const [item, entityOptions] = await Promise.all([
    getReviewItem(ctx.org.id, id, filters, threshold),
    listEntityOptions(ctx.org.id),
  ]);
  if (!item) notFound();

  const labels = entityLabels(ctx.org.entity_kind);
  const query = queueQueryString(filters);
  const doc = item.document;
  // An archived entity isn't an option any more, but the record may still point at it.
  const { entity_id: entityId } = item.record;
  const options =
    entityId && item.entityName && !entityOptions.some((o) => o.value === entityId)
      ? [...entityOptions, { value: entityId, label: item.entityName }]
      : entityOptions;
  const names = new Map(options.map((o) => [o.value, o.label]));
  const recordSplit = item.allocations.filter((a) => !a.lineItemId);
  const reviewer = canReview(ctx.role);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">
        {reviewCopy.title}: {doc?.fileName ?? item.record.supplier_name ?? item.record.id}
      </h1>
      {/* Keyed on updated_at: after a save the form starts again from the stored record. */}
      <ReviewWorkspace
        key={item.record.updated_at}
        record={item.record}
        lineItems={item.lineItems}
        context={item.context}
        entityOptions={options}
        entitySingular={labels.singular}
        canReview={reviewer}
        approverName={item.approverName}
        nav={{
          queueHref: `/app/review${query}`,
          prevHref: item.prevId ? `/app/review/${item.prevId}${query}` : null,
          nextHref: item.nextId ? `/app/review/${item.nextId}${query}` : null,
          position: item.position,
          queueSize: item.queueSize,
        }}
        preview={
          doc ? (
            <div className="flex flex-col gap-2">
              <p className="truncate text-sm font-semibold" title={doc.fileName}>
                {doc.fileName}
              </p>
              <DocumentViewer
                url={doc.fileUrl}
                mimeType={doc.mimeType}
                fileName={doc.fileName}
                initialPage={item.initialPage}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{reviewCopy.item.noDocument}</p>
          )
        }
        split={
          <AllocationEditor
            key={`${item.record.updated_at}-${item.allocations.length}`}
            recordId={item.record.id}
            totalCents={item.record.total_cents}
            currency={item.record.currency}
            homeEntityId={item.record.entity_id}
            entityOptions={options}
            initial={recordSplit.length ? { method: recordSplit[0]!.method, rows: recordSplit } : null}
            hasLineSplits={item.allocations.some((a) => a.lineItemId)}
            disabled={!reviewer || item.record.status === "rejected"}
            disabledReason={!reviewer ? allocationCopy.readOnly : allocationCopy.rejected}
            singular={labels.singular}
            plural={labels.plural}
          />
        }
        history={
          <RecordTimeline
            events={item.timeline}
            currency={item.record.currency}
            entitySingular={labels.singular}
            names={names}
          />
        }
      />
    </div>
  );
}
