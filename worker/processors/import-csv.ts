import type { SupabaseClient } from "@supabase/supabase-js";
import { SYSTEM_ACTOR_ID } from "@/lib/audit/actors";
import { forOrg } from "@/lib/db/org-scope";
import { errorReportCsv, parseCsv } from "@/lib/import/csv";
import type { ImportMapping } from "@/lib/import/fields";
import { parseRow, type ImportRecord } from "@/lib/import/rows";
import type { JobPayload } from "@/lib/queue";
import type { Database } from "@/lib/supabase/database.types";
import { validateRecord } from "@/lib/validation";
import { loadValidationContext, toValidationRecord } from "@/lib/validation/load";

/**
 * `import-csv`: parse the uploaded CSV, validate every row (lib/import/rows.ts — invalid rows never insert), insert
 * the valid ones as records (`import_records`, audited as the importer), run the same lib/validation as extracted
 * records (issues → review queue; "approve on import" approves only issue-free records), and write an error report
 * (row, column, message). Idempotent: only a `queued` import is processed.
 */

type Db = SupabaseClient<Database>;
const CHUNK = 200;

export interface ImportDeps {
  db: Db;
  log?: (message: string, meta: Record<string, unknown>) => void;
}

export async function importCsvJob(
  { orgId, importId }: JobPayload<"import-csv">,
  { db, log = () => undefined }: ImportDeps,
): Promise<{ outcome: "done" | "skipped" | "failed"; ok?: number; failed?: number }> {
  const scope = forOrg(db, orgId);
  const job = await scope.requireRow("imports", importId);
  if (job.status !== "queued") return { outcome: "skipped" };
  await scope.update("imports", { status: "processing", error: null }).eq("id", importId);
  const actor = job.created_by ?? SYSTEM_ACTOR_ID;

  const fail = async (message: string) => {
    await scope.update("imports", { status: "failed", error: message }).eq("id", importId);
    return { outcome: "failed" as const };
  };

  const download = await db.storage.from("imports").download(job.storage_path);
  if (download.error || !download.data) return fail("The uploaded file could not be found.");
  const { rows, truncated } = parseCsv(await download.data.text());
  if (truncated) return fail("The file has more than 5,000 rows. Split it into smaller files.");
  if (rows.length === 0) return fail("The file has no rows.");

  const [{ data: org, error: orgError }, { data: entities, error: entityError }] = await Promise.all([
    db.from("organizations").select("default_currency").eq("id", orgId).single(),
    db.from("entities").select("id, name, code").eq("org_id", orgId),
  ]);
  if (orgError) throw orgError;
  if (entityError) throw entityError;

  const mapping = job.mapping as ImportMapping;
  const valid: ImportRecord[] = [];
  const errors: { row: number; column: string; message: string }[] = [];
  rows.forEach((row, i) => {
    const result = parseRow(row, mapping, { entities, defaultCurrency: org.default_currency });
    // Spreadsheet row numbers: the header is row 1.
    if (result.ok) valid.push(result.record);
    else for (const e of result.errors) errors.push({ row: i + 2, ...e });
  });
  const failedRows = new Set(errors.map((e) => e.row)).size;

  // Insert, then validate each record against the org (other imported rows included, so duplicates inside the
  // file are caught too).
  const ids: string[] = [];
  for (let i = 0; i < valid.length; i += CHUNK) {
    const { data, error } = await db.rpc("import_records", {
      p_org: orgId,
      p_import: importId,
      p_actor: actor,
      p_rows: valid.slice(i, i + CHUNK) as never,
    });
    if (error) throw error;
    ids.push(...data);
  }
  for (const id of ids) {
    const { data: record, error } = await db
      .from("records")
      .select("*")
      .eq("org_id", orgId)
      .eq("id", id)
      .single();
    if (error) throw error;
    const forValidation = toValidationRecord(record, []);
    const { autoApprove: _ignored, ...ctx } = await loadValidationContext(db, {
      orgId,
      record: forValidation,
      documentId: null,
      sha256: null,
    });
    const issues = validateRecord(forValidation, ctx);
    const { error: finishError } = await db.rpc("finish_import_record", {
      p_org: orgId,
      p_record: id,
      p_issues: issues as never,
      p_approve: job.approve,
      p_actor: actor,
    });
    if (finishError) throw finishError;
  }

  let reportPath: string | null = null;
  if (errors.length) {
    reportPath = `${orgId}/imports/${importId}-errors.csv`;
    const upload = await db.storage
      .from("imports")
      .upload(reportPath, new Blob([errorReportCsv(errors)], { type: "text/csv" }), { upsert: true });
    if (upload.error) throw upload.error;
  }
  const { error: doneError } = await scope
    .update("imports", {
      status: "done",
      rows_total: rows.length,
      rows_ok: ids.length,
      rows_failed: failedRows,
      error_report_path: reportPath,
    })
    .eq("id", importId);
  if (doneError) throw doneError;
  log("import done", { orgId, importId, rows: rows.length, ok: ids.length, failed: failedRows });
  return { outcome: "done", ok: ids.length, failed: failedRows };
}
