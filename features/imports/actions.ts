"use server";

import { RATE_LIMITED } from "@/lib/security/rate-limit";
import { allow } from "@/lib/security/rate-limit.server";
import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/actions/result";
import { canReview, canWrite, ForbiddenError } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { parseCsv } from "@/lib/import/csv";
import { IMPORT_FIELDS, REQUIRED_FIELDS, type ImportMapping } from "@/lib/import/fields";
import { suggestMapping } from "@/lib/import/mapping";
import { QUEUES, enqueue } from "@/lib/queue";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateImportSchema, StartImportSchema } from "./schema";

/*
 * CSV import Server Actions: (1) the browser uploads the file to `{org}/imports/`, createImport reads its header and
 * first rows and suggests a mapping; (2) startImport stores the mapping and queues `import-csv`. The worker validates
 * every row; nothing invalid is inserted.
 */

const FORBIDDEN = new ForbiddenError().message;
const PREVIEW_ROWS = 50;
const MAX_BYTES = 5 * 1024 * 1024;

export interface ImportPreview {
  importId: string;
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
  mapping: ImportMapping;
}

export async function createImport(input: unknown): Promise<ActionResult<ImportPreview>> {
  const parsed = CreateImportSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, "Upload a CSV file.");
  const ctx = await requireActiveOrg();
  if (!canWrite(ctx.role)) return fail(FORBIDDEN);
  if (!(await allow("import", ctx.userId))) return fail(RATE_LIMITED);
  const { storagePath, fileName } = parsed.data;
  if (!storagePath.startsWith(`${ctx.org.id}/`)) return fail(FORBIDDEN);

  const supabase = await createSupabaseServerClient();
  const { data: blob, error: downloadError } = await supabase.storage.from("imports").download(storagePath);
  if (downloadError || !blob) return fail("The file could not be read. Upload it again.");
  if (blob.size > MAX_BYTES) return fail("The file is larger than 5 MB. Split it into smaller files.");
  const csv = parseCsv(await blob.text());
  if (csv.truncated) return fail("The file has more than 5,000 rows. Split it into smaller files.");
  if (csv.headers.length === 0 || csv.rows.length === 0) return fail("The file has no rows.");

  const { data, error } = await supabase
    .from("imports")
    .insert({ org_id: ctx.org.id, file_name: fileName, storage_path: storagePath })
    .select("id")
    .single();
  if (error) return fail("Something went wrong. Please try again.");
  return ok({
    importId: data.id,
    headers: csv.headers,
    rows: csv.rows.slice(0, PREVIEW_ROWS),
    rowCount: csv.rows.length,
    mapping: suggestMapping(csv.headers, ctx.org.import_mapping as ImportMapping),
  });
}

export async function startImport(input: unknown): Promise<ActionResult> {
  const parsed = StartImportSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await requireActiveOrg();
  if (!canWrite(ctx.role) || (parsed.data.approve && !canReview(ctx.role))) return fail(FORBIDDEN);
  const { importId, mapping, approve } = parsed.data;
  const missing = REQUIRED_FIELDS.filter((f) => !mapping[f]);
  if (missing.length) {
    const labels = missing.map((f) => IMPORT_FIELDS.find((x) => x.key === f)!.label);
    return fail(`Choose a column for: ${labels.join(", ")}.`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("start_import", {
    p_import: importId,
    p_mapping: mapping,
    p_approve: approve,
  });
  if (error) {
    if (error.code === "22023") return fail("This import has already started.");
    if (error.code === "42501") return fail(FORBIDDEN);
    if (error.code === "P0002") return fail("Import not found.");
    return fail("Something went wrong. Please try again.");
  }
  await enqueue(QUEUES.importCsv, { orgId: ctx.org.id, importId }, `import-${importId}`);
  revalidatePath("/app/data");
  return ok();
}
