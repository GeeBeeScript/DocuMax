import type { Metadata } from "next";
import { Archive, Building2, HardHat } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { FormAlert } from "@/components/app/form-alert";
import { PageHeader } from "@/components/app/page-header";
import { ViewToggle } from "@/components/app/view-toggle";
import { entitiesCopy } from "@/content/app";
import { EntityCollection, type EntityView } from "@/features/entities/components/entity-collection";
import { NewEntityButton } from "@/features/entities/components/new-entity-button";
import { listEntities, type EntityStatus } from "@/features/entities/queries";
import { canManageEntities } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { entityLabels } from "@/lib/entities/labels";

export const metadata: Metadata = { title: "Properties & jobs" };

type SearchParams = Promise<{ view?: string; status?: string }>;

export default async function EntitiesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const view: EntityView = params.view === "table" ? "table" : "grid";
  const status: EntityStatus = params.status === "archived" ? "archived" : "active";
  const ctx = await requireActiveOrg();
  const labels = entityLabels(ctx.org.entity_kind);
  const canManage = canManageEntities(ctx.role);
  const entities = await listEntities(ctx.org.id, status);
  const href = (next: { view?: EntityView; status?: EntityStatus }) => {
    const q = new URLSearchParams({ view: next.view ?? view, status: next.status ?? status });
    return `/app/entities?${q}`;
  };
  const empty = status === "archived" ? entitiesCopy.empty.archived : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={labels.plural}
        description={entitiesCopy.description(labels.plural)}
        actions={canManage && <NewEntityButton labels={labels} />}
      />
      {!canManage && <FormAlert tone="info">{entitiesCopy.readOnly}</FormAlert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewToggle
          label={entitiesCopy.filters.label}
          value={status}
          options={[
            { value: "active", label: entitiesCopy.filters.active, href: href({ status: "active" }) },
            { value: "archived", label: entitiesCopy.filters.archived, href: href({ status: "archived" }) },
          ]}
        />
        <ViewToggle
          label={entitiesCopy.views.label}
          value={view}
          options={[
            { value: "grid", label: entitiesCopy.views.grid, href: href({ view: "grid" }) },
            { value: "table", label: entitiesCopy.views.table, href: href({ view: "table" }) },
          ]}
        />
      </div>
      {entities.length === 0 ? (
        <EmptyState
          icon={status === "archived" ? Archive : ctx.org.entity_kind === "property" ? Building2 : HardHat}
          title={empty?.title ?? entitiesCopy.empty.active.title(labels.plural)}
          description={empty?.description ?? entitiesCopy.empty.active.description(labels.singular)}
          action={canManage && status === "active" ? <NewEntityButton labels={labels} /> : undefined}
        />
      ) : (
        <EntityCollection entities={entities} view={view} labels={labels} canManage={canManage} />
      )}
    </div>
  );
}
