import type { Metadata } from "next";
import { FileChartColumn } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { FormAlert } from "@/components/app/form-alert";
import { PageHeader } from "@/components/app/page-header";
import { RealtimeRefresh } from "@/components/app/realtime-refresh";
import { reportsCopy } from "@/content/app";
import { MonthReportButton } from "@/features/reports/components/generate-dialogs";
import { BatchList, ReportList } from "@/features/reports/components/report-list";
import { listBatches, listReports } from "@/features/reports/queries";
import { canReview } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { currentMonth, shiftMonth } from "@/lib/calc/period";
import { entityLabels } from "@/lib/entities/labels";

export const metadata: Metadata = { title: reportsCopy.title };

export default async function ReportsPage() {
  const ctx = await requireActiveOrg();
  const labels = entityLabels(ctx.org.entity_kind);
  const [reports, batches] = await Promise.all([listReports(ctx.org.id), listBatches(ctx.org.id)]);
  const active =
    reports.some((r) => r.status === "queued" || r.status === "rendering") ||
    batches.some((b) => b.status === "running" || b.status === "zipping");
  // Statements usually go out for the month that just ended.
  const lastMonth = shiftMonth(currentMonth(ctx.org.timezone), -1).start.slice(0, 7);
  const reviewer = canReview(ctx.role);

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh orgId={ctx.org.id} tables={["reports", "report_batches"]} active={active} />
      <PageHeader
        title={reportsCopy.title}
        description={reportsCopy.description}
        actions={
          reviewer && (
            <>
              <MonthReportButton kind="summary" defaultMonth={lastMonth} plural={labels.plural} />
              <MonthReportButton kind="batch" defaultMonth={lastMonth} plural={labels.plural} />
            </>
          )
        }
      />
      {!reviewer && <FormAlert tone="info">{reportsCopy.readOnly}</FormAlert>}
      {batches.length > 0 && (
        <section aria-labelledby="batches-heading" className="flex flex-col gap-3">
          <h2 id="batches-heading" className="font-heading text-lg font-bold">
            {reportsCopy.batches.title}
          </h2>
          <BatchList batches={batches} />
        </section>
      )}
      {reports.length === 0 ? (
        <EmptyState
          icon={FileChartColumn}
          title={reportsCopy.empty.title}
          description={reportsCopy.empty.description}
        />
      ) : (
        <ReportList reports={reports} />
      )}
    </div>
  );
}
