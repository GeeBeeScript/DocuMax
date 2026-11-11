import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OrgScopeError } from "@/lib/db/org-scope";
import { markDocumentFailed, processDocument, WORKER_ACTOR_ID } from "@/worker/processors/process-document";
import { adminClient, cleanup, createOrg, createUser, type TestUser } from "../helpers";

const db = adminClient();
const deps = { db, stepMs: 0 };
let owner: TestUser, outsider: TestUser;
let orgId: string, otherOrgId: string;

/** A queued document; with `withFile` its object exists in Storage. */
async function queuedDocument(withFile = true) {
  const id = randomUUID();
  const path = `${orgId}/documents/${id}/invoice.pdf`;
  await db.from("documents").insert({
    id,
    org_id: orgId,
    uploaded_by: owner.id,
    storage_path: path,
    file_name: "invoice.pdf",
    mime_type: "application/pdf",
    size_bytes: 9,
  });
  if (withFile)
    await db.storage.from("documents").upload(path, new Blob(["%PDF-1.4"], { type: "application/pdf" }));
  await owner.client.rpc("confirm_document_upload", { p_document: id });
  return id;
}
const statusOf = async (id: string) =>
  (await db.from("documents").select("status, error").eq("id", id).single()).data;

beforeAll(async () => {
  [owner, outsider] = await Promise.all([createUser("wk-owner"), createUser("wk-out")]);
  orgId = (await createOrg(owner, "Worker Org")).id;
  otherOrgId = (await createOrg(outsider, "Worker Other")).id;
});

afterAll(async () => {
  const { data } = await db.from("documents").select("storage_path").eq("org_id", orgId);
  if (data?.length) await db.storage.from("documents").remove(data.map((d) => d.storage_path));
  await cleanup([orgId, otherOrgId], [owner, outsider]);
});

describe("process-document (stub)", () => {
  it("walks queued → extracting → analyzing → validating → ready, audited to the worker", async () => {
    const id = await queuedDocument();
    const seen: string[] = [];
    const result = await processDocument(
      { orgId, documentId: id },
      { ...deps, log: (_m, meta) => seen.push(String(meta.status)) },
    );
    expect(result).toEqual({ outcome: "done", status: "ready" });
    expect(seen.filter((s) => s !== "undefined")).toEqual(["extracting", "analyzing", "validating", "ready"]);
    const { data } = await db
      .from("audit_log")
      .select("actor_id")
      .eq("row_id", id)
      .eq("action", "update")
      .order("id");
    expect(data?.slice(-4).every((a) => a.actor_id === WORKER_ACTOR_ID)).toBe(true);
  });

  it("is idempotent: re-running a finished job is a no-op", async () => {
    const id = await queuedDocument();
    await processDocument({ orgId, documentId: id }, deps);
    expect(await processDocument({ orgId, documentId: id }, deps)).toEqual({
      outcome: "skipped",
      status: "ready",
    });
  });

  it("refuses a payload whose org doesn't own the document", async () => {
    const id = await queuedDocument();
    await expect(processDocument({ orgId: otherOrgId, documentId: id }, deps)).rejects.toBeInstanceOf(
      OrgScopeError,
    );
    expect((await statusOf(id))?.status).toBe("queued");
  });

  it("fails the document with a clear message when the file is missing", async () => {
    const id = await queuedDocument(false);
    expect(await processDocument({ orgId, documentId: id }, deps)).toEqual({
      outcome: "failed",
      status: "failed",
    });
    expect(await statusOf(id)).toEqual({ status: "failed", error: "The uploaded file could not be found." });
  });

  it("stops when another attempt moved the document", async () => {
    const id = await queuedDocument();
    const result = await processDocument(
      { orgId, documentId: id },
      {
        ...deps,
        // Simulate a concurrent attempt grabbing the document between our steps.
        sleep: async () => {
          await db.rpc("transition_document", {
            p_org: orgId,
            p_document: id,
            p_from: ["queued"],
            p_to: "extracting",
          });
        },
      },
    );
    expect(result.outcome).toBe("skipped");
  });

  it("markDocumentFailed records the final failure for in-flight documents only", async () => {
    const id = await queuedDocument();
    await markDocumentFailed(db, { orgId, documentId: id }, "boom");
    expect(await statusOf(id)).toEqual({ status: "failed", error: "boom" });
    const done = await queuedDocument();
    await processDocument({ orgId, documentId: done }, deps);
    await markDocumentFailed(db, { orgId, documentId: done }, "late");
    expect((await statusOf(done))?.status).toBe("ready");
  });
});
