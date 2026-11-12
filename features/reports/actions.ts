"use server";

import { RATE_LIMITED } from "@/lib/security/rate-limit";
import { allow } from "@/lib/security/rate-limit.server";
import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/actions/result";
import { canReview, ForbiddenError } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { addDays, todayIn } from "@/lib/calc/period";
import { QUEUES, enqueue } from "@/lib/queue";
import { quoteFileName, statementFileName, summaryFileName } from "@/lib/reports/file-names";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BatchSchema, QuoteReportSchema, StatementReportSchema, SummaryReportSchema } from "./schema";

/*
 * Report Server Actions: validate → role check → create the row(s) in the database (create_report /
 * create_statement_batch check the role again) → enqueue `render-report` per report. Rendering happens in the
 * worker; the reports page follows progress live.
 */

const REPORTS_PATH = "/app/reports";
const FORBIDDEN = new ForbiddenError().message;

function dbError(error: { code?: string; message: string }) {
  if (error.code === "22023")
    return fail(error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".");
  if (error.code === "42501") return fail(FORBIDDEN);
  return fail("Something went wrong. Please try again.");
}

async function queue(orgId: string, reportIds: readonly string[]) {
  for (const reportId of reportIds)
    await enqueue(QUEUES.renderReport, { orgId, reportId }, `report-${reportId}`);
}

async function entityName(orgId: string, entityId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("entities")
    .select("name")
    .eq("org_id", orgId)
    .eq("id", entityId)
    .maybeSingle();
  return data?.name ?? null;
}

export async function generateStatement(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = StatementReportSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, parsed.error.issues[0]?.message);
  const ctx = await requireActiveOrg();
  if (!canReview(ctx.role)) return fail(FORBIDDEN);
  if (!(await allow("report", ctx.userId))) return fail(RATE_LIMITED);
  const { entityId, period } = parsed.data;
  const name = await entityName(ctx.org.id, entityId);
  if (!name) return fail("Not found.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_report", {
    p_org: ctx.org.id,
    p_kind: "statement",
    p_entity: entityId,
    p_start: period.start,
    p_end: period.end,
    p_params: {},
    p_file_name: statementFileName(name, period),
  });
  if (error) return dbError(error);
  await queue(ctx.org.id, [data.id]);
  revalidatePath(REPORTS_PATH);
  return ok({ id: data.id });
}

export async function generateSummary(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = SummaryReportSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, parsed.error.issues[0]?.message);
  const ctx = await requireActiveOrg();
  if (!canReview(ctx.role)) return fail(FORBIDDEN);
  if (!(await allow("report", ctx.userId))) return fail(RATE_LIMITED);
  const { period } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_report", {
    p_org: ctx.org.id,
    p_kind: "summary",
    p_entity: null as unknown as string, // summaries cover every entity (generated types miss nullability)
    p_start: period.start,
    p_end: period.end,
    p_params: {},
    p_file_name: summaryFileName(period),
  });
  if (error) return dbError(error);
  await queue(ctx.org.id, [data.id]);
  revalidatePath(REPORTS_PATH);
  return ok({ id: data.id });
}

export async function generateQuote(input: unknown): Promise<ActionResult<{ id: string; number: string }>> {
  const parsed = QuoteReportSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, parsed.error.issues[0]?.message);
  const ctx = await requireActiveOrg();
  if (!canReview(ctx.role)) return fail(FORBIDDEN);
  if (!(await allow("report", ctx.userId))) return fail(RATE_LIMITED);
  const { entityId, period, markupBp, taxRateBp, validDays, notes } = parsed.data;
  const name = await entityName(ctx.org.id, entityId);
  if (!name) return fail("Not found.");
  const issueDate = todayIn(ctx.org.timezone);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_report", {
    p_org: ctx.org.id,
    p_kind: "quote",
    p_entity: entityId,
    p_start: period.start,
    p_end: period.end,
    p_params: {
      markupBp,
      taxRateBp,
      issueDate,
      validUntil: addDays(issueDate, validDays),
      notes: notes || null,
    },
    p_file_name: quoteFileName("{number}", name),
  });
  if (error) return dbError(error);
  await queue(ctx.org.id, [data.id]);
  revalidatePath(REPORTS_PATH);
  return ok({ id: data.id, number: String((data.params as { number?: string }).number ?? "") });
}

export async function generateStatementBatch(
  input: unknown,
): Promise<ActionResult<{ batchId: string; total: number }>> {
  const parsed = BatchSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, parsed.error.issues[0]?.message);
  const ctx = await requireActiveOrg();
  if (!canReview(ctx.role)) return fail(FORBIDDEN);
  if (!(await allow("report", ctx.userId))) return fail(RATE_LIMITED);
  const { period } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: entities, error: entitiesError } = await supabase
    .from("entities")
    .select("id, name")
    .eq("org_id", ctx.org.id)
    .eq("status", "active");
  if (entitiesError) return dbError(entitiesError);
  const names = Object.fromEntries(entities.map((e) => [e.id, statementFileName(e.name, period)]));

  const { data: batch, error } = await supabase.rpc("create_statement_batch", {
    p_org: ctx.org.id,
    p_start: period.start,
    p_end: period.end,
    p_file_names: names,
  });
  if (error) return dbError(error);
  const { data: reports, error: listError } = await supabase
    .from("reports")
    .select("id")
    .eq("org_id", ctx.org.id)
    .eq("batch_id", batch.id);
  if (listError) return dbError(listError);
  await queue(
    ctx.org.id,
    reports.map((r) => r.id),
  );
  revalidatePath(REPORTS_PATH);
  return ok({ batchId: batch.id, total: batch.total });
}
