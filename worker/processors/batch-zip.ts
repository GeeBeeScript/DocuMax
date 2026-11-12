import type { SupabaseClient } from "@supabase/supabase-js";
import { zipSync } from "fflate";
import { forOrg } from "@/lib/db/org-scope";
import type { JobPayload } from "@/lib/queue";
import { uniqueNames } from "@/lib/reports/file-names";
import type { Database } from "@/lib/supabase/database.types";

/**
 * `batch-zip`: once every report of a batch has finished (report_batch_progress → `zipping`), put the ready PDFs
 * into one ZIP at `{org}/batches/{batch}.zip` and mark the batch `ready`. Idempotent: only a `zipping` batch is
 * processed; a retry rebuilds the same archive. Failed reports are left out (the batch shows how many).
 */

export interface BatchZipDeps {
  db: SupabaseClient<Database>;
  log?: (message: string, meta: Record<string, unknown>) => void;
}

export async function batchZipJob(
  { orgId, batchId }: JobPayload<"batch-zip">,
  { db, log = () => undefined }: BatchZipDeps,
): Promise<{ outcome: "done" | "skipped" | "failed"; files?: string[] }> {
  const scope = forOrg(db, orgId);
  const batch = await scope.requireRow("report_batches", batchId);
  if (batch.status !== "zipping") return { outcome: "skipped" };

  const { data, error } = await scope
    .select("reports", "id, file_name, storage_path")
    .eq("batch_id", batchId)
    .eq("status", "ready")
    .order("file_name");
  if (error) throw error;
  const reports = data as unknown as { id: string; file_name: string; storage_path: string }[];

  if (reports.length === 0) {
    await scope
      .update("report_batches", { status: "failed", error: "None of the statements could be generated." })
      .eq("id", batchId);
    return { outcome: "failed" };
  }

  const names = uniqueNames(reports.map((r) => r.file_name));
  const files: Record<string, Uint8Array> = {};
  for (const [i, r] of reports.entries()) {
    const { data: blob, error: dlError } = await db.storage.from("reports").download(r.storage_path);
    if (dlError || !blob) throw dlError ?? new Error(`missing PDF for report ${r.id}`);
    files[names[i]!] = new Uint8Array(await blob.arrayBuffer());
  }
  // PDFs are already compressed: store them (level 0) — fast and no bigger.
  const zip = zipSync(files, { level: 0 });
  const path = `${orgId}/batches/${batchId}.zip`;
  const upload = await db.storage
    .from("reports")
    .upload(path, zip, { contentType: "application/zip", upsert: true });
  if (upload.error) throw upload.error;
  const { error: updateError } = await scope
    .update("report_batches", { status: "ready", zip_path: path, error: null })
    .eq("id", batchId);
  if (updateError) throw updateError;
  log("batch zipped", { orgId, batchId, files: names.length, bytes: zip.byteLength });
  return { outcome: "done", files: names };
}
