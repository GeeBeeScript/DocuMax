import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { FormAlert } from "@/components/app/form-alert";
import { PageHeader } from "@/components/app/page-header";
import { PillButton } from "@/components/brand/pill-button";
import { statementsCopy } from "@/content/app";
import { EntityReportActions } from "@/features/reports/components/generate-dialogs";
import { EntityStatement } from "@/features/statements/components/entity-statement";
import { PeriodPicker } from "@/features/statements/components/period-picker";
import { parsePeriodParams } from "@/features/statements/period-params";
import { getStatementEntity, loadStatementRecords } from "@/features/statements/queries";
import { buildStatement } from "@/lib/calc/statement";
import { canReview } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { entityLabels } from "@/lib/entities/labels";

export const metadata: Metadata = { title: "Costs" };

export default async function EntityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireActiveOrg();
  const entity = await getStatementEntity(ctx.org.id, id);
  if (!entity) notFound();

  const labels = entityLabels(ctx.org.entity_kind);
  const selection = parsePeriodParams(query, ctx.org.timezone);
  const records = await loadStatementRecords(ctx.org.id, selection.period, entity.id);
  const statement = buildStatement({
    org: { name: ctx.org.name },
    entity,
    period: selection.period,
    currency: ctx.org.default_currency,
    records,
    generatedAt: new Date().toISOString(),
  });
  const facts: [string, string | null][] = [
    [labels.fields.code, entity.code],
    [labels.fields.address, entity.address],
    [labels.fields.clientName, entity.clientName],
  ];

  return (
    <div className="flex flex-col gap-6">
      <PillButton href="/app/entities" variant="ghost" size="sm" className="self-start">
        <ArrowLeft aria-hidden /> {statementsCopy.back(labels.plural)}
      </PillButton>
      <PageHeader
        title={entity.name}
        actions={
          canReview(ctx.role) && (
            <EntityReportActions
              entityId={entity.id}
              entityName={entity.name}
              period={selection.period}
              quotes={ctx.org.entity_kind === "job"}
            />
          )
        }
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {facts
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <span key={k}>
                  <span className="font-semibold text-ink-soft">{k}:</span> {v}
                </span>
              ))}
          </span>
        }
      />
      <PeriodPicker basePath={`/app/entities/${entity.id}`} period={selection.period} mode={selection.mode} />
      {selection.error && <FormAlert tone="danger">{selection.error}</FormAlert>}
      {statement.lines.length === 0 && statement.otherCurrencies.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={statementsCopy.empty.title}
          description={statementsCopy.empty.description}
        />
      ) : (
        <EntityStatement data={statement} />
      )}
    </div>
  );
}
