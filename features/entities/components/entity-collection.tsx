import { FileText, MapPin, UserRound } from "lucide-react";
import { DataTable } from "@/components/app/data-table";
import { entitiesCopy } from "@/content/app";
import type { EntityLabels } from "@/lib/entities/labels";
import type { EntitySummary } from "../queries";
import { EntityActions } from "./entity-actions";

export type EntityView = "grid" | "table";

const formValues = (e: EntitySummary) => ({
  id: e.id,
  name: e.name,
  code: e.code,
  address: e.address,
  clientName: e.clientName,
});

/** Entities as a card grid (Miro board tiles) or a dense table. Actions only for managers. */
export function EntityCollection({
  entities,
  view,
  labels,
  canManage,
}: {
  entities: EntitySummary[];
  view: EntityView;
  labels: EntityLabels;
  canManage: boolean;
}) {
  const actions = (e: EntitySummary) =>
    canManage ? (
      <EntityActions entity={formValues(e)} archived={e.status === "archived"} labels={labels} />
    ) : null;

  if (view === "table") {
    return (
      <DataTable
        caption={labels.plural}
        rows={entities}
        getRowKey={(e) => e.id}
        columns={[
          { key: "name", header: labels.fields.name, rowHeader: true, cell: (e) => e.name },
          { key: "code", header: labels.fields.code, cell: (e) => e.code ?? "—" },
          {
            key: "client",
            header: labels.fields.clientName,
            hideOnMobile: true,
            cell: (e) => e.clientName ?? "—",
          },
          {
            key: "address",
            header: labels.fields.address,
            hideOnMobile: true,
            cell: (e) => e.address ?? "—",
          },
          {
            key: "docs",
            header: entitiesCopy.columns.documents,
            align: "right",
            className: "tabular-nums",
            cell: (e) => e.documentCount,
          },
          ...(canManage
            ? [
                {
                  key: "actions",
                  header: <span className="sr-only">Actions</span>,
                  align: "right" as const,
                  cell: actions,
                },
              ]
            : []),
        ]}
      />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entities.map((e) => (
        <li key={e.id} className="min-w-0">
          <article className="flex h-full flex-col gap-3 rounded-2xl border border-gray-200 bg-paper p-5 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold">{e.name}</h3>
                {e.code && (
                  <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{e.code}</p>
                )}
              </div>
              {actions(e)}
            </div>
            <dl className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {e.address && (
                <div className="flex items-center gap-2">
                  <dt className="sr-only">{labels.fields.address}</dt>
                  <MapPin className="size-4 shrink-0" aria-hidden />
                  <dd className="truncate">{e.address}</dd>
                </div>
              )}
              {e.clientName && (
                <div className="flex items-center gap-2">
                  <dt className="sr-only">{labels.fields.clientName}</dt>
                  <UserRound className="size-4 shrink-0" aria-hidden />
                  <dd className="truncate">{e.clientName}</dd>
                </div>
              )}
              <div className="flex items-center gap-2">
                <dt className="sr-only">{entitiesCopy.columns.documents}</dt>
                <FileText className="size-4 shrink-0" aria-hidden />
                <dd className="tabular-nums">{e.documentCount}</dd>
              </div>
            </dl>
          </article>
        </li>
      ))}
    </ul>
  );
}
