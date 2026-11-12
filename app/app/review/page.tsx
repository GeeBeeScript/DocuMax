import type { Metadata } from "next";
import { ClipboardCheck, SearchX } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { reviewCopy } from "@/content/app";
import { listEntityOptions } from "@/features/entities/queries";
import { BulkApproveButton } from "@/features/review/components/bulk-approve-button";
import { QueueFilterBar } from "@/features/review/components/queue-filters";
import { ReviewQueueTable } from "@/features/review/components/review-queue-table";
import { parseQueueFilters, queueQueryString } from "@/features/review/filters";
import { listReviewQueue } from "@/features/review/queries";
import { canReview } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { entityLabels } from "@/lib/entities/labels";

export const metadata: Metadata = { title: reviewCopy.title };

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireActiveOrg();
  const filters = parseQueueFilters(await searchParams);
  const threshold = Number(ctx.org.review_threshold);
  const labels = entityLabels(ctx.org.entity_kind);
  const [queue, entityOptions] = await Promise.all([
    listReviewQueue(ctx.org.id, filters, threshold),
    listEntityOptions(ctx.org.id),
  ]);
  const cleanIds = queue.items.filter((i) => i.issues.length === 0).map((i) => i.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={reviewCopy.title}
        description={reviewCopy.description}
        actions={canReview(ctx.role) && <BulkApproveButton recordIds={cleanIds} />}
      />
      {queue.total === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={reviewCopy.queue.empty.title}
          description={reviewCopy.queue.empty.description}
        />
      ) : (
        <>
          <QueueFilterBar
            filters={filters}
            counts={queue.counts}
            total={queue.total}
            entityOptions={entityOptions}
            entitySingular={labels.singular}
            entityPlural={labels.plural}
          />
          <p className="text-sm text-muted-foreground" role="status">
            {reviewCopy.queue.showing(queue.items.length, queue.total)}
          </p>
          {queue.items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={reviewCopy.queue.noMatches.title}
              description={reviewCopy.queue.noMatches.description}
            />
          ) : (
            <ReviewQueueTable
              items={queue.items}
              query={queueQueryString(filters)}
              threshold={threshold}
              entitySingular={labels.singular}
            />
          )}
        </>
      )}
    </div>
  );
}
