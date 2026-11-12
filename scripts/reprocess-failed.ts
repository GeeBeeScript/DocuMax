/**
 * OPS: re-queue failed documents (docs/RUNBOOKS.md → Reprocess failed documents).
 *   npm run reprocess -- --org <org uuid> [--since 2026-11-01] [--dry-run]
 * Uses the service role (operators only). Each document goes failed → queued (audited as the worker) and gets a new
 * process-document job. Users can also retry one document from its page.
 */
import "../worker/load-env";
import { z } from "zod";
import { enqueue, closeQueues, QUEUES } from "@/lib/queue";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { WORKER_ACTOR_ID } from "@/worker/processors/process-document";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) =>
      a.startsWith("--") ? [a.slice(2), all[i + 1]?.startsWith("--") ? "1" : (all[i + 1] ?? "1")] : [],
    )
    .filter((e) => e.length),
);
const opts = z
  .object({ org: z.uuid(), since: z.iso.date().optional(), "dry-run": z.string().optional() })
  .parse(args);

void (async () => {
  const db = createSupabaseAdminClient();
  let query = db
    .from("documents")
    .select("id, file_name, error, updated_at")
    .eq("org_id", opts.org)
    .eq("status", "failed");
  if (opts.since) query = query.gte("updated_at", opts.since);
  const { data, error } = await query.order("updated_at").limit(1000);
  if (error) throw error;
  console.log(`${data.length} failed document(s)${opts["dry-run"] ? " (dry run)" : ""}`);
  for (const doc of data) {
    console.log(`- ${doc.id} ${doc.file_name}: ${doc.error ?? ""}`);
    if (opts["dry-run"]) continue;
    const { data: moved, error: moveError } = await db.rpc("transition_document", {
      p_org: opts.org,
      p_document: doc.id,
      p_from: ["failed"],
      p_to: "queued",
      p_actor: WORKER_ACTOR_ID,
    });
    if (moveError) throw moveError;
    if (moved?.id)
      await enqueue(
        QUEUES.processDocument,
        { orgId: opts.org, documentId: doc.id },
        `${doc.id}-reprocess-${Date.now()}`,
      );
  }
  await closeQueues();
})();
