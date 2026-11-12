import type { SupabaseClient } from "@supabase/supabase-js";
import { forOrg } from "@/lib/db/org-scope";
import { entityLabels } from "@/lib/entities/labels";
import { todayIn } from "@/lib/calc/period";
import { buildQuote } from "@/lib/calc/quote";
import { buildPortfolio, buildStatement } from "@/lib/calc/statement";
import type { JobPayload } from "@/lib/queue";
import { QuoteParamsSchema } from "@/lib/reports/params";
import { getStatementEntity, listStatementEntities, loadStatementRecords } from "@/lib/statements/load";
import type { Database } from "@/lib/supabase/database.types";
import { DEFAULT_BRAND_COLOR, type Branding } from "@/pdf/components/brand-bar";
import { renderReport, type RenderedReport, type ReportDocument } from "@/pdf/document";
import { date } from "@/pdf/format";
import { monthlyStatement } from "@/pdf/templates/monthly-statement";
import { portfolioSummary } from "@/pdf/templates/portfolio-summary";
import { quote } from "@/pdf/templates/quote";
import { reportCopy } from "@/content/reports";

/**
 * `render-report` (docs/ARCHITECTURE.md): report row → figures from lib/calc → template → HTML → PDF (Chromium) →
 * Storage `{org}/reports/{id}.pdf` → status `ready`. Idempotent: a ready report is skipped; a retry re-renders and
 * overwrites. Problems that retrying can't fix (deleted entity, bad quote options) fail the report at once.
 * When a batch's last report finishes, `batch-zip` is enqueued (exactly once — report_batch_progress()).
 */

type Db = SupabaseClient<Database>;

export class ReportProblem extends Error {}

export interface RenderReportDeps {
  db: Db;
  render: (report: RenderedReport) => Promise<Uint8Array>;
  enqueueZip: (payload: JobPayload<"batch-zip">) => Promise<void>;
  now?: () => Date;
  log?: (message: string, meta: Record<string, unknown>) => void;
}

const LOGO_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

async function loadBranding(
  db: Db,
  org: Database["public"]["Tables"]["organizations"]["Row"],
): Promise<Branding> {
  let logoDataUri: string | null = null;
  if (org.logo_path) {
    const { data } = await db.storage.from("branding").download(org.logo_path);
    const type = LOGO_TYPES[org.logo_path.split(".").pop()?.toLowerCase() ?? ""];
    if (data && type)
      logoDataUri = `data:${type};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
  }
  return {
    orgName: org.name,
    logoDataUri,
    brandColor: org.brand_color ?? DEFAULT_BRAND_COLOR,
    footerText: org.footer_text,
  };
}

async function finishBatch(db: Db, orgId: string, batchId: string | null, deps: RenderReportDeps) {
  if (!batchId) return;
  const { data, error } = await db.rpc("report_batch_progress", { p_org: orgId, p_batch: batchId });
  if (error) throw error;
  if (data) await deps.enqueueZip({ orgId, batchId });
}

export async function markReportFailed(
  db: Db,
  { orgId, reportId }: JobPayload<"render-report">,
  message: string,
  deps: Pick<RenderReportDeps, "enqueueZip">,
) {
  const { data } = await forOrg(db, orgId)
    .update("reports", { status: "failed", error: message })
    .eq("id", reportId)
    .neq("status", "ready")
    .select("batch_id");
  const batchId = (data as { batch_id: string | null }[] | null)?.[0]?.batch_id ?? null;
  await finishBatch(db, orgId, batchId, { ...deps, db } as RenderReportDeps);
}

export async function renderReportJob(
  payload: JobPayload<"render-report">,
  deps: RenderReportDeps,
): Promise<{ outcome: "done" | "skipped" | "failed" }> {
  const { orgId, reportId } = payload;
  const { db, log = () => undefined, now = () => new Date() } = deps;
  const scope = forOrg(db, orgId);
  const report = await scope.requireRow("reports", reportId);
  if (report.status === "ready") return { outcome: "skipped" };

  await scope
    .update("reports", { status: "rendering", attempts: report.attempts + 1, error: null })
    .eq("id", reportId);

  try {
    const { data: org, error } = await db.from("organizations").select("*").eq("id", orgId).single();
    if (error) throw error;
    const labels = entityLabels(org.entity_kind);
    const period = { start: report.period_start, end: report.period_end };
    const generatedAt = now();

    let doc: ReportDocument;
    if (report.kind === "summary") {
      const [entities, records] = await Promise.all([
        listStatementEntities(db, orgId),
        loadStatementRecords(db, orgId, period),
      ]);
      const data = buildPortfolio({
        org: { name: org.name },
        entities,
        period,
        currency: org.default_currency,
        records,
      });
      doc = portfolioSummary(data, { entityPlural: labels.plural });
    } else {
      const entity = report.entity_id ? await getStatementEntity(db, orgId, report.entity_id) : null;
      if (!entity) throw new ReportProblem(`The ${labels.singular.toLowerCase()} no longer exists.`);
      const records = await loadStatementRecords(db, orgId, period, entity.id);
      if (report.kind === "statement") {
        const data = buildStatement({
          org: { name: org.name },
          entity,
          period,
          currency: org.default_currency,
          records,
          generatedAt: generatedAt.toISOString(),
        });
        doc = monthlyStatement(data, { entitySingular: labels.singular });
      } else {
        const params = QuoteParamsSchema.safeParse(report.params);
        if (!params.success) throw new ReportProblem("The quote options are invalid.");
        const data = buildQuote({
          org: { name: org.name },
          entity,
          period,
          currency: org.default_currency,
          records,
          ...params.data,
          generatedAt: generatedAt.toISOString(),
        });
        doc = quote(data);
      }
    }

    const branding = await loadBranding(db, org);
    const started = Date.now();
    const pdf = await deps.render(
      renderReport(doc, branding, reportCopy.generated(date(todayIn(org.timezone, generatedAt)))),
    );
    const path = `${orgId}/reports/${reportId}.pdf`;
    const upload = await db.storage
      .from("reports")
      .upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (upload.error) throw upload.error;

    const { error: updateError } = await scope
      .update("reports", {
        status: "ready",
        storage_path: path,
        page_count: doc.pages.length,
        byte_size: pdf.byteLength,
        error: null,
      })
      .eq("id", reportId);
    if (updateError) throw updateError;
    log("report rendered", {
      orgId,
      reportId,
      kind: report.kind,
      pages: doc.pages.length,
      ms: Date.now() - started,
    });
    await finishBatch(db, orgId, report.batch_id, deps);
    return { outcome: "done" };
  } catch (error) {
    if (error instanceof ReportProblem) {
      await markReportFailed(db, payload, error.message, deps);
      log("report failed permanently", { orgId, reportId, message: error.message });
      return { outcome: "failed" };
    }
    throw error; // transient → BullMQ retry; the last failure is recorded by the worker's failed handler
  }
}
