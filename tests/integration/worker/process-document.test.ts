import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OrgScopeError } from "@/lib/db/org-scope";
import { createTesseractEngine, type OcrEngine } from "@/lib/pipeline/ocr";
import { markDocumentFailed, processDocument, WORKER_ACTOR_ID } from "@/worker/processors/process-document";
import { adminClient, cleanup, createOrg, createUser, type TestUser } from "../helpers";

const db = adminClient();
/** Fast stand-in for Tesseract; the scanned-PDF test uses the real engine. */
const fakeOcr: OcrEngine = {
  recognize: async () => ({ text: "OCR TEXT Brightline Plumbing", confidence: 0.9 }),
  terminate: async () => undefined,
};
const deps = { db, ocr: fakeOcr, stepMs: 0 };
let owner: TestUser, outsider: TestUser;
let orgId: string, otherOrgId: string;

const fixture = (p: string) => readFile(path.join(process.cwd(), "tests/fixtures", p));

/** A queued document whose object holds `fixturePath` (or nothing). */
async function queuedDocument(
  fixturePath: string | null = "pdf/digital-invoice.pdf",
  mimeType = "application/pdf",
) {
  const id = randomUUID();
  const storagePath = `${orgId}/documents/${id}/${fixturePath ? path.basename(fixturePath) : "missing.pdf"}`;
  const bytes = fixturePath ? await fixture(fixturePath) : Buffer.from("x");
  await db.from("documents").insert({
    id,
    org_id: orgId,
    uploaded_by: owner.id,
    storage_path: storagePath,
    file_name: path.basename(storagePath),
    mime_type: mimeType,
    size_bytes: bytes.length,
  });
  if (fixturePath)
    await db.storage.from("documents").upload(storagePath, new Blob([bytes], { type: mimeType }));
  await owner.client.rpc("confirm_document_upload", { p_document: id });
  return id;
}
const doc = async (id: string) =>
  (await db.from("documents").select("status, error, page_count, sha256").eq("id", id).single()).data;
const pages = async (id: string) =>
  (
    await db
      .from("document_pages")
      .select("page_no, source, ocr_confidence, text")
      .eq("document_id", id)
      .order("page_no")
  ).data ?? [];

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

describe("process-document — stage 1", () => {
  it("digital PDF: text layer saved, sha256 + page count recorded, walks to ready as the worker", async () => {
    const id = await queuedDocument();
    expect(await processDocument({ orgId, documentId: id }, deps)).toEqual({
      outcome: "done",
      status: "ready",
    });
    expect(await doc(id)).toMatchObject({
      status: "ready",
      page_count: 1,
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const [page] = await pages(id);
    expect(page).toMatchObject({ page_no: 1, source: "text_layer", ocr_confidence: null });
    expect(page.text).toContain("INV-2041");

    const { data } = await db
      .from("audit_log")
      .select("actor_id, diff")
      .eq("row_id", id)
      .eq("action", "update")
      .order("id");
    expect(data?.slice(-4).map((a) => a.actor_id)).toEqual(Array(4).fill(WORKER_ACTOR_ID));
    expect(data?.map((a) => (a.diff as { status?: string }).status).filter(Boolean)).toEqual([
      "queued",
      "extracting",
      "analyzing",
      "validating",
      "ready",
    ]);
  });

  it("scanned PDF: every page OCR'd with confidence (real Tesseract)", async () => {
    const ocr = await createTesseractEngine({ workers: 2 });
    try {
      const id = await queuedDocument("pdf/scanned-invoice-3-pages.pdf");
      expect((await processDocument({ orgId, documentId: id }, { ...deps, ocr })).status).toBe("ready");
      const saved = await pages(id);
      expect(saved.map((p) => p.source)).toEqual(["ocr", "ocr", "ocr"]);
      for (const p of saved) {
        expect(Number(p.ocr_confidence)).toBeGreaterThan(0.7);
        expect(p.text).toContain("INV-3307");
      }
    } finally {
      await ocr.terminate();
    }
  }, 60_000);

  it("mixed PDF: only the sparse page goes through OCR", async () => {
    const id = await queuedDocument("pdf/mixed-invoice.pdf");
    await processDocument({ orgId, documentId: id }, deps);
    expect((await pages(id)).map((p) => [p.page_no, p.source])).toEqual([
      [1, "text_layer"],
      [2, "ocr"],
    ]);
  });

  it("photo receipt: one OCR page", async () => {
    const id = await queuedDocument("images/photo-receipt.jpg", "image/jpeg");
    await processDocument({ orgId, documentId: id }, deps);
    expect(await pages(id)).toEqual([
      expect.objectContaining({ page_no: 1, source: "ocr", ocr_confidence: 0.9 }),
    ]);
  });

  it.each([
    ["pdf/corrupt.pdf", /damaged or incomplete/],
    ["pdf/password-protected.pdf", /password-protected/],
  ])("%s fails immediately with a readable error (no retry)", async (file, message) => {
    const id = await queuedDocument(file);
    expect(await processDocument({ orgId, documentId: id }, deps)).toEqual({
      outcome: "failed",
      status: "failed",
    });
    expect(await doc(id)).toMatchObject({ status: "failed", error: expect.stringMatching(message) });
    expect(await pages(id)).toEqual([]);
  });

  it("missing file fails with a clear message", async () => {
    const id = await queuedDocument(null);
    expect(await processDocument({ orgId, documentId: id }, deps)).toEqual({
      outcome: "failed",
      status: "failed",
    });
    expect((await doc(id))?.error).toBe("The uploaded file could not be found.");
  });

  it("a transient error is rethrown for BullMQ to retry, and the retry resumes from extracting", async () => {
    const id = await queuedDocument("pdf/scanned-invoice-3-pages.pdf");
    const flaky: OcrEngine = {
      ...fakeOcr,
      recognize: async () => Promise.reject(new Error("tesseract crashed")),
    };
    await expect(processDocument({ orgId, documentId: id }, { ...deps, ocr: flaky })).rejects.toThrow(
      "tesseract crashed",
    );
    expect((await doc(id))?.status).toBe("extracting");
    expect(await processDocument({ orgId, documentId: id }, deps)).toEqual({
      outcome: "done",
      status: "ready",
    });
    expect(await pages(id)).toHaveLength(3);
  });
});

describe("process-document — guard rails", () => {
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
    expect((await doc(id))?.status).toBe("queued");
  });

  it("save_document_pages refuses a stale job and another org", async () => {
    const id = await queuedDocument();
    const call = (org: string) =>
      db.rpc("save_document_pages", {
        p_org: org,
        p_document: id,
        p_page_count: 1,
        p_pages: [{ page_no: 1, text: "x", source: "text_layer" }],
      });
    expect((await call(orgId)).data?.id ?? null).toBeNull(); // still queued, not extracting
    await db.rpc("transition_document", {
      p_org: orgId,
      p_document: id,
      p_from: ["queued"],
      p_to: "extracting",
    });
    expect((await call(otherOrgId)).data?.id ?? null).toBeNull();
    expect(await pages(id)).toEqual([]);
  });

  it("users cannot call save_document_pages or write pages", async () => {
    const id = await queuedDocument();
    const rpc = await owner.client.rpc("save_document_pages", {
      p_org: orgId,
      p_document: id,
      p_page_count: 1,
      p_pages: [],
    });
    expect(rpc.error).not.toBeNull();
    const insert = await owner.client
      .from("document_pages")
      .insert({ org_id: orgId, document_id: id, page_no: 1, text: "x", source: "text_layer" });
    expect(insert.error?.code).toBe("42501");
  });

  it("stops when another attempt moved the document", async () => {
    const id = await queuedDocument();
    await db.rpc("transition_document", {
      p_org: orgId,
      p_document: id,
      p_from: ["queued"],
      p_to: "extracting",
    });
    await db.rpc("transition_document", {
      p_org: orgId,
      p_document: id,
      p_from: ["extracting"],
      p_to: "failed",
      p_error: "x",
    });
    expect((await processDocument({ orgId, documentId: id }, deps)).outcome).toBe("skipped");
  });

  it("markDocumentFailed records the final failure for in-flight documents only", async () => {
    const id = await queuedDocument();
    await markDocumentFailed(db, { orgId, documentId: id }, "boom");
    expect(await doc(id)).toMatchObject({ status: "failed", error: "boom" });
    const done = await queuedDocument();
    await processDocument({ orgId, documentId: done }, deps);
    await markDocumentFailed(db, { orgId, documentId: done }, "late");
    expect((await doc(done))?.status).toBe("ready");
  });
});
