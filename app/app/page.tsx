import { Building2, FileStack, HardHat, Upload, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { QuickStartCard } from "@/components/app/quick-start-card";
import { PillButton } from "@/components/brand/pill-button";
import { dashboardCopy } from "@/content/app";
import { DocumentList } from "@/features/documents/components/document-list";
import { listDocuments } from "@/features/documents/queries";
import { canManageMembers, canWrite } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { entityLabels } from "@/lib/entities/labels";

export default async function DashboardPage() {
  const ctx = await requireActiveOrg();
  const labels = entityLabels(ctx.org.entity_kind);
  const documents = await listDocuments(ctx.org.id, 8);
  const { cards } = dashboardCopy;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={dashboardCopy.greeting(ctx.profile.full_name)}
        description={dashboardCopy.description}
      />

      <section aria-labelledby="getting-started" className="flex flex-col gap-4">
        <h2 id="getting-started" className="text-lg font-bold">
          {dashboardCopy.gettingStarted}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canWrite(ctx.role) && (
            <li>
              <QuickStartCard
                icon={Upload}
                title={cards.upload.title}
                description={cards.upload.description}
                action={
                  <PillButton href="/app/documents" size="sm">
                    {cards.upload.cta}
                  </PillButton>
                }
              />
            </li>
          )}
          <li>
            <QuickStartCard
              icon={ctx.org.entity_kind === "property" ? Building2 : HardHat}
              title={cards.entities.title(labels.plural)}
              description={cards.entities.description(labels.plural)}
              action={
                <PillButton href="/app/entities" size="sm" variant="outline">
                  {cards.entities.cta(labels.plural)}
                </PillButton>
              }
            />
          </li>
          {canManageMembers(ctx.role) && (
            <li>
              <QuickStartCard
                icon={UserPlus}
                title={cards.invite.title}
                description={cards.invite.description}
                action={
                  <PillButton href="/app/settings/members" size="sm" variant="outline">
                    {cards.invite.cta}
                  </PillButton>
                }
              />
            </li>
          )}
        </ul>
      </section>

      <section aria-labelledby="recent-documents" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 id="recent-documents" className="text-lg font-bold">
            {dashboardCopy.recent}
          </h2>
          {documents.length > 0 && (
            <PillButton href="/app/documents" size="sm" variant="ghost">
              {dashboardCopy.viewAll}
            </PillButton>
          )}
        </div>
        {documents.length === 0 ? (
          <EmptyState
            icon={FileStack}
            title={dashboardCopy.empty.title}
            description={dashboardCopy.empty.description}
            action={
              canWrite(ctx.role) ? (
                <PillButton href="/app/documents" size="sm">
                  {dashboardCopy.empty.cta}
                </PillButton>
              ) : undefined
            }
          />
        ) : (
          <DocumentList orgId={ctx.org.id} documents={documents} entityHeader={labels.singular} />
        )}
      </section>
    </div>
  );
}
