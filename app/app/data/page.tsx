import type { Metadata } from "next";
import { FormAlert } from "@/components/app/form-alert";
import { PageHeader } from "@/components/app/page-header";
import { RealtimeRefresh } from "@/components/app/realtime-refresh";
import { dataCopy } from "@/content/app";
import { ExportForm } from "@/features/data/components/export-form";
import { listEntityOptions } from "@/features/entities/queries";
import { ImportHistory } from "@/features/imports/components/import-history";
import { ImportWizard } from "@/features/imports/components/import-wizard";
import { listImports } from "@/features/imports/queries";
import { canReview, canWrite } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { entityLabels } from "@/lib/entities/labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: dataCopy.title };

export default async function DataPage() {
  const ctx = await requireActiveOrg();
  const labels = entityLabels(ctx.org.entity_kind);
  const supabase = await createSupabaseServerClient();
  const [entityOptions, imports, { data: entities }] = await Promise.all([
    listEntityOptions(ctx.org.id),
    listImports(ctx.org.id),
    supabase.from("entities").select("id, name, code").eq("org_id", ctx.org.id),
  ]);
  const active = imports.some((i) => i.status === "queued" || i.status === "processing");

  return (
    <div className="flex flex-col gap-8">
      <RealtimeRefresh orgId={ctx.org.id} tables={["imports"]} active={active} />
      <PageHeader title={dataCopy.title} description={dataCopy.description} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="export-heading"
          className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-paper p-6"
        >
          <h2 id="export-heading" className="font-heading text-lg font-bold">
            {dataCopy.export.title}
          </h2>
          <p className="text-sm text-muted-foreground">{dataCopy.export.description}</p>
          <ExportForm
            entityOptions={entityOptions}
            entitySingular={labels.singular}
            entityPlural={labels.plural}
          />
        </section>
        <section
          aria-labelledby="import-heading"
          className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-paper p-6"
        >
          <h2 id="import-heading" className="font-heading text-lg font-bold">
            {dataCopy.import.title}
          </h2>
          <p className="text-sm text-muted-foreground">{dataCopy.import.description}</p>
          {canWrite(ctx.role) ? (
            <ImportWizard
              orgId={ctx.org.id}
              entities={entities ?? []}
              defaultCurrency={ctx.org.default_currency}
              canApprove={canReview(ctx.role)}
            />
          ) : (
            <FormAlert tone="info">{dataCopy.import.readOnly}</FormAlert>
          )}
        </section>
      </div>
      {imports.length > 0 && (
        <section aria-labelledby="imports-heading" className="flex flex-col gap-3">
          <h2 id="imports-heading" className="font-heading text-lg font-bold">
            {dataCopy.history.title}
          </h2>
          <ImportHistory imports={imports} />
        </section>
      )}
    </div>
  );
}
