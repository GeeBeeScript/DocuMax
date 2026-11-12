import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OrgScopeError } from "@/lib/db/org-scope";
import { createTesseractEngine, type OcrEngine } from "@/lib/pipeline/ocr";
import { markDocumentFailed, processDocument, WORKER_ACTOR_ID } from "@/worker/processors/process-document";
import { recordedOutput, replayModel } from "@/tests/support/mock-ai";
import { addMember, adminClient, cleanup, createOrg, createUser, type TestUser } from "../helpers";

const db = adminClient();
/** Fast stand-in for Tesseract; the scanned-PDF test uses the real engine. */
const fakeOcr: OcrEngine = {
  recognize: async () => ({ text: "OCR TEXT Brightline Plumbing", confidence: 0.9 }),
  terminate: async () => undefined,
};
const aiReplying = (...replies: Parameters<typeof replayModel>[0]) => ({
  model: replayModel(replies),
  info: { provider: "test", model: "replay" },
});
/** Default: every extraction returns the recorded digital-invoice output. */
const deps = {
  db,
  ocr: fakeOcr,
  ai: aiReplying({ text: recordedOutput("valid-digital-invoice.json") }),
  stepMs: 0,
};
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
  it("digital PDF: text layer saved, sha256 + page count recorded, walks to review as the worker", async () => {
    const id = await queuedDocument();
    expect(await processDocument({ orgId, documentId: id }, deps)).toEqual({
      outcome: "done",
      status: "needs_review",
    });
    expect(await doc(id)).toMatchObject({
      status: "needs_review",
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
      "needs_review",
    ]);
  });

  it("scanned PDF: every page OCR'd with confidence (real Tesseract)", async () => {
    const ocr = await createTesseractEngine({ workers: 2 });
    try {
      const id = await queuedDocument("pdf/scanned-invoice-3-pages.pdf");
      expect((await processDocument({ orgId, documentId: id }, { ...deps, ocr })).status).toBe(
        "needs_review",
      );
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
      status: "needs_review",
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
      status: "needs_review",
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
    expect((await doc(done))?.status).toBe("needs_review");
  });
});

describe("process-document — stage 2 (AI extraction)", () => {
  const record = async (documentId: string) =>
    (await db.from("records").select("*").eq("document_id", documentId).single()).data;
  const lines = async (recordId: string) =>
    (
      await db
        .from("line_items")
        .select("position, amount_cents, quantity, category")
        .eq("record_id", recordId)
        .order("position")
    ).data ?? [];

  it("saves the record in cents with line items, logs the extraction and matches the entity", async () => {
    const { data: elm } = await db
      .from("entities")
      .insert({ org_id: orgId, kind: "property", name: "12 Elm Street", code: "ELM-12" })
      .select()
      .single();
    const id = await queuedDocument();
    expect(await processDocument({ orgId, documentId: id }, deps)).toEqual({
      outcome: "done",
      status: "needs_review",
    });

    const rec = await record(id);
    expect(rec).toMatchObject({
      org_id: orgId,
      status: "needs_review",
      supplier_name: "Brightline Plumbing Co.",
      invoice_number: "INV-2041",
      issue_date: "2026-10-14",
      currency: "USD",
      subtotal_cents: 116450,
      tax_cents: 9607,
      total_cents: 126057,
      entity_id: elm!.id,
      min_confidence: 0.9,
    });
    expect(await lines(rec!.id)).toEqual([
      { position: 1, amount_cents: 42000, quantity: 1, category: "repairs_maintenance" },
      { position: 2, amount_cents: 56000, quantity: 3.5, category: "labor_subcontract" },
      { position: 3, amount_cents: 18450, quantity: 4, category: "materials" },
    ]);
    // The matched entity is put on the document too.
    expect((await db.from("documents").select("entity_id").eq("id", id).single()).data?.entity_id).toBe(
      elm!.id,
    );

    const { data: extraction } = await db.from("extractions").select("*").eq("document_id", id).single();
    expect(extraction).toMatchObject({
      provider: "test",
      model: "replay",
      schema_version: 1,
      attempts: 1,
      tokens_in: 1200,
      tokens_out: 300,
    });
    expect(rec!.extraction_id).toBe(extraction!.id);

    // Audited as the worker.
    const { data: audit } = await db
      .from("audit_log")
      .select("actor_id")
      .eq("row_id", rec!.id)
      .eq("action", "insert")
      .single();
    expect(audit?.actor_id).toBe(WORKER_ACTOR_ID);
  });

  it("a user's entity assignment at upload wins over the AI's suggestion", async () => {
    const { data: other } = await db
      .from("entities")
      .insert({ org_id: orgId, kind: "property", name: "Oak Plaza" })
      .select()
      .single();
    const id = await queuedDocument();
    await db.from("documents").update({ entity_id: other!.id }).eq("id", id);
    await processDocument({ orgId, documentId: id }, deps);
    expect((await record(id))?.entity_id).toBe(other!.id);
  });

  it("a refusal fails the document with a readable message (no retry)", async () => {
    const id = await queuedDocument();
    const result = await processDocument(
      { orgId, documentId: id },
      { ...deps, ai: aiReplying({ text: "", finish: "content-filter" }) },
    );
    expect(result).toEqual({ outcome: "failed", status: "failed" });
    expect(await doc(id)).toMatchObject({
      status: "failed",
      error: "The AI service declined to process this document.",
    });
    expect(await record(id)).toBeNull();
  });

  it("output that keeps failing validation fails the document after 3 attempts", async () => {
    const id = await queuedDocument();
    const result = await processDocument(
      { orgId, documentId: id },
      { ...deps, ai: aiReplying({ text: recordedOutput("invalid-fields.json") }) },
    );
    expect(result.outcome).toBe("failed");
    expect((await doc(id))?.error).toMatch(/couldn't produce a valid result/);
  });

  it("a transient API error is retried by the job and resumes at stage 2 without re-running OCR", async () => {
    const id = await queuedDocument("pdf/scanned-invoice-3-pages.pdf");
    let ocrCalls = 0;
    const countingOcr: OcrEngine = {
      ...fakeOcr,
      recognize: async (png) => (ocrCalls++, fakeOcr.recognize(png)),
    };
    const flaky = aiReplying({ throws: new Error("overloaded") });
    await expect(
      processDocument({ orgId, documentId: id }, { ...deps, ocr: countingOcr, ai: flaky }),
    ).rejects.toThrow("overloaded");
    expect((await doc(id))?.status).toBe("analyzing");
    const afterStage1 = ocrCalls;

    expect(await processDocument({ orgId, documentId: id }, { ...deps, ocr: countingOcr })).toEqual({
      outcome: "done",
      status: "needs_review",
    });
    expect(ocrCalls).toBe(afterStage1);
    expect(await record(id)).not.toBeNull();
  });

  it("re-processing never overwrites a record a human already approved", async () => {
    const id = await queuedDocument();
    await processDocument({ orgId, documentId: id }, deps);
    const rec = await record(id);
    await db.from("records").update({ status: "approved", total_cents: 1 }).eq("id", rec!.id);
    // Put the document back into stage 2 and run again.
    await db.rpc("transition_document", {
      p_org: orgId,
      p_document: id,
      p_from: ["needs_review"],
      p_to: "analyzing",
    });
    await processDocument({ orgId, documentId: id }, deps);
    expect(await record(id)).toMatchObject({ status: "approved", total_cents: 1 });
    expect((await db.from("extractions").select("id").eq("document_id", id)).data).toHaveLength(2);
  });

  it("save_extraction is worker-only and status-checked", async () => {
    const id = await queuedDocument();
    const args = { p_org: orgId, p_document: id, p_extraction: {}, p_record: {}, p_lines: [] };
    expect((await owner.client.rpc("save_extraction", args)).error).not.toBeNull();
    expect((await db.rpc("save_extraction", args)).data?.id ?? null).toBeNull(); // queued, not analyzing
  });
});

describe("process-document — stages 3–4 (validation + routing)", () => {
  const record = async (documentId: string) =>
    (await db.from("records").select("*").eq("document_id", documentId).single()).data;
  const issueCodes = async (recordId: string) =>
    ((await db.from("validation_issues").select("code").eq("record_id", recordId)).data ?? [])
      .map((i) => i.code)
      .sort();

  /** A recorded output for a unique, internally consistent invoice (no line items, entity hint "12 Elm Street"). */
  const cleanOutput = (invoiceNumber: string, total = "126057") => {
    const raw = JSON.parse(recordedOutput("valid-digital-invoice.json"));
    raw.invoiceNumber.value = invoiceNumber;
    raw.total.value = (Number(total) / 100).toFixed(2);
    raw.subtotal.value = ((Number(total) - 9607) / 100).toFixed(2);
    raw.lineItems = [];
    raw.supplier.name.value = `Clean Supplier ${invoiceNumber}`;
    return JSON.stringify(raw);
  };
  // A fresh org: earlier tests upload the same fixture files and create look-alike properties, which would
  // (correctly) trigger duplicate / ambiguous-entity results here. `owner` joins it so queuedDocument works.
  let elmId: string;
  let sharedOrgId: string;
  let validationOwner: TestUser;
  beforeAll(async () => {
    sharedOrgId = orgId;
    validationOwner = await createUser("wk-validate");
    orgId = (await createOrg(validationOwner, "Validation Org")).id;
    await addMember(orgId, owner, "member");
    const { data } = await db
      .from("entities")
      .insert({ org_id: orgId, kind: "property", name: "12 Elm Street", code: "ELM-V" })
      .select()
      .single();
    elmId = data!.id;
  });
  afterAll(async () => {
    const { data } = await db.from("documents").select("storage_path").eq("org_id", orgId);
    if (data?.length) await db.storage.from("documents").remove(data.map((d) => d.storage_path));
    await cleanup([orgId], [validationOwner]);
    orgId = sharedOrgId;
  });

  it("a clean document is ready; the record waits for approval and has no issues", async () => {
    const id = await queuedDocument("pdf/utility-bill.pdf");
    const result = await processDocument(
      { orgId, documentId: id },
      { ...deps, ai: aiReplying({ text: cleanOutput("CLEAN-1") }) },
    );
    expect(result).toEqual({ outcome: "done", status: "ready" });
    const rec = await record(id);
    expect(rec).toMatchObject({ status: "needs_review", entity_id: elmId });
    expect(await issueCodes(rec!.id)).toEqual([]);
  });

  it("with auto-approve on, a clean record is approved by the system (audited)", async () => {
    await db.from("organizations").update({ auto_approve: true }).eq("id", orgId);
    const id = await queuedDocument("pdf/credit-note.pdf");
    expect(
      (
        await processDocument(
          { orgId, documentId: id },
          { ...deps, ai: aiReplying({ text: cleanOutput("CLEAN-2") }) },
        )
      ).status,
    ).toBe("ready");
    const rec = await record(id);
    expect(rec).toMatchObject({ status: "approved", approved_by: null });
    const { data: actions } = await db
      .from("review_actions")
      .select("action, actor_id, reason")
      .eq("record_id", rec!.id);
    expect(actions).toEqual([
      { action: "approve", actor_id: null, reason: "Auto-approved: no issues found" },
    ]);
    await db.from("organizations").update({ auto_approve: false }).eq("id", orgId);
  });

  it("issues route to review even with auto-approve; they are stored per record", async () => {
    await db.from("organizations").update({ auto_approve: true }).eq("id", orgId);
    const id = await queuedDocument("pdf/mixed-invoice.pdf");
    const raw = JSON.parse(cleanOutput("FLAGGED-1"));
    raw.total.value = "999.99"; // subtotal + tax ≠ total
    raw.entityHint.value = null;
    expect(
      (
        await processDocument(
          { orgId, documentId: id },
          { ...deps, ai: aiReplying({ text: JSON.stringify(raw) }) },
        )
      ).status,
    ).toBe("needs_review");
    const rec = await record(id);
    expect(rec?.status).toBe("needs_review");
    expect(await issueCodes(rec!.id)).toEqual(["no_entity", "total_mismatch"]);
    await db.from("organizations").update({ auto_approve: false }).eq("id", orgId);
  });

  it("a second upload of the same invoice is flagged as a duplicate (and the same file as duplicate_file)", async () => {
    const first = await queuedDocument("images/sample-receipt.png", "image/png");
    await processDocument(
      { orgId, documentId: first },
      { ...deps, ai: aiReplying({ text: cleanOutput("DUP-77") }) },
    );
    const second = await queuedDocument("images/sample-receipt.png", "image/png");
    await processDocument(
      { orgId, documentId: second },
      { ...deps, ai: aiReplying({ text: cleanOutput("dup 77") }) },
    );
    expect(await issueCodes((await record(second))!.id)).toEqual(["duplicate", "duplicate_file"]);
  });
});
