import { Building2, FileStack, HardHat, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { QuickStartCard } from "@/components/app/quick-start-card";
import { PillButton } from "@/components/brand/pill-button";
import { dashboardCopy } from "@/content/app";
import { canManageMembers } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { entityLabels } from "@/lib/entities/labels";

export default async function DashboardPage() {
  const ctx = await requireActiveOrg();
  const labels = entityLabels(ctx.org.entity_kind);
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
          {canManageMembers(ctx.role) && (
            <li>
              <QuickStartCard
                icon={UserPlus}
                title={cards.invite.title}
                description={cards.invite.description}
                action={
                  <PillButton href="/app/settings/members" size="sm">
                    {cards.invite.cta}
                  </PillButton>
                }
              />
            </li>
          )}
          <li>
            <QuickStartCard
              muted
              icon={ctx.org.entity_kind === "property" ? Building2 : HardHat}
              title={cards.entities.title(labels.plural)}
              description={cards.entities.description(labels.plural)}
            />
          </li>
        </ul>
      </section>

      <EmptyState
        icon={FileStack}
        title={dashboardCopy.empty.title(labels.plural)}
        description={dashboardCopy.empty.description}
      />
    </div>
  );
}
