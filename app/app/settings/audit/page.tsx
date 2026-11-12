import type { Metadata } from "next";
import { History } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { FormAlert } from "@/components/app/form-alert";
import { PageHeader } from "@/components/app/page-header";
import { SelectField } from "@/components/app/select-field";
import { PillButton } from "@/components/brand/pill-button";
import { auditCopy } from "@/content/app";
import { AuditLogTable } from "@/features/audit/components/audit-log-table";
import { AUDITED_TABLES, auditQueryString, parseAuditFilters } from "@/features/audit/filters";
import { listAuditLog } from "@/features/audit/queries";
import { listEntityOptions } from "@/features/entities/queries";
import { listMembers } from "@/features/org/queries";
import { canManageMembers } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { entityLabels } from "@/lib/entities/labels";

export const metadata: Metadata = { title: auditCopy.title };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireActiveOrg();
  if (!canManageMembers(ctx.role)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={auditCopy.title} />
        <FormAlert tone="info">{auditCopy.forbidden}</FormAlert>
      </div>
    );
  }
  const filters = parseAuditFilters(await searchParams);
  const [{ entries, nextBefore }, members, entityOptions] = await Promise.all([
    listAuditLog(ctx.org.id, filters),
    listMembers(ctx.org.id),
    listEntityOptions(ctx.org.id),
  ]);
  const labels = entityLabels(ctx.org.entity_kind);
  const current = { table: filters.table, actor: filters.actor };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={auditCopy.title} description={auditCopy.description} />
      <form method="get" className="flex flex-wrap items-end gap-3">
        <SelectField
          id="audit-table"
          name="table"
          label={auditCopy.filters.table}
          defaultValue={filters.table ?? ""}
          options={[
            { value: "", label: auditCopy.filters.anyTable },
            ...AUDITED_TABLES.map((t) => ({ value: t, label: auditCopy.tables[t] ?? t })),
          ]}
          className="w-full sm:w-52"
        />
        <SelectField
          id="audit-actor"
          name="actor"
          label={auditCopy.filters.actor}
          defaultValue={filters.actor ?? ""}
          options={[
            { value: "", label: auditCopy.filters.anyActor },
            ...members.map((m) => ({ value: m.userId, label: m.name ?? m.email })),
          ]}
          className="w-full sm:w-56"
        />
        <PillButton type="submit" variant="outline" size="sm" className="h-10">
          {auditCopy.filters.apply}
        </PillButton>
        {(filters.table || filters.actor) && (
          <PillButton href="/app/settings/audit" variant="ghost" size="sm" className="h-10">
            {auditCopy.filters.clear}
          </PillButton>
        )}
      </form>
      {entries.length === 0 ? (
        <EmptyState icon={History} title={auditCopy.empty.title} description={auditCopy.empty.description} />
      ) : (
        <AuditLogTable
          entries={entries}
          entitySingular={labels.singular}
          names={
            new Map([
              ...entityOptions.map((o) => [o.value, o.label] as const),
              ...members.map((m) => [m.userId, m.name ?? m.email] as const),
            ])
          }
        />
      )}
      <div className="flex gap-2">
        {filters.before && (
          <PillButton href={`/app/settings/audit${auditQueryString(current)}`} variant="ghost" size="sm">
            {auditCopy.newest}
          </PillButton>
        )}
        {nextBefore && (
          <PillButton
            href={`/app/settings/audit${auditQueryString({ ...current, before: nextBefore })}`}
            variant="outline"
            size="sm"
          >
            {auditCopy.older}
          </PillButton>
        )}
      </div>
    </div>
  );
}
