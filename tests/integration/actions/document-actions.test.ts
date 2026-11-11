import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addMember, adminClient, cleanup, createOrg, createUser, type TestUser } from "../helpers";
import { actAs, enqueued, resetEnqueued } from "../next-mocks";

const actions = await import("@/features/documents/actions");
const admin = adminClient();
let owner: TestUser, member: TestUser, viewer: TestUser, outsider: TestUser;
let orgId: string, otherOrgId: string, entityId: string, otherEntityId: string;

const pdf = (text: string) => new TextEncoder().encode(`%PDF-1.4\n${text}\n%%EOF`);
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const meta = (bytes: Uint8Array, extra: Record<string, unknown> = {}) => ({
  fileName: "Invoice #7.pdf",
  mimeType: "application/pdf",
  sizeBytes: bytes.byteLength,
  sha256: sha(bytes),
  ...extra,
});
const put = (url: string, bytes: Uint8Array) =>
  fetch(url, { method: "PUT", body: new Blob([bytes as BlobPart]), headers: { "content-type": "application/pdf" } });
const doc = async (id: string) => (await admin.from("documents").select("*").eq("id", id).single()).data;

/** requestUpload → PUT → confirmUpload, returning the document id. */
async function upload(bytes: Uint8Array, extra: Record<string, unknown> = {}) {
  const ticket = await actions.requestUpload(meta(bytes, extra));
  if (!ticket.ok) throw new Error(ticket.error);
  expect((await put(ticket.data.uploadUrl, bytes)).ok).toBe(true);
  const confirmed = await actions.confirmUpload({ documentId: ticket.data.documentId });
  return { ticket: ticket.data, confirmed };
}

beforeAll(async () => {
  [owner, member, viewer, outsider] = await Promise.all(
    ["up-owner", "up-member", "up-viewer", "up-out"].map(createUser),
  );
  orgId = (await createOrg(owner, "Upload Org")).id;
  otherOrgId = (await createOrg(outsider, "Other Upload Org")).id;
  await addMember(orgId, member, "member");
  await addMember(orgId, viewer, "viewer");
  entityId = (
    await admin.from("entities").insert({ org_id: orgId, kind: "property", name: "Elm" }).select().single()
  ).data!.id;
  otherEntityId = (
    await admin
      .from("entities")
      .insert({ org_id: otherOrgId, kind: "property", name: "Theirs" })
      .select()
      .single()
  ).data!.id;
});

beforeEach(() => {
  resetEnqueued();
  actAs(member);
});

afterAll(async () => {
  for (const org of [orgId, otherOrgId]) {
    const { data: docs } = await admin.from("documents").select("storage_path").eq("org_id", org);
    if (docs?.length) await admin.storage.from("documents").remove(docs.map((d) => d.storage_path));
  }
  await cleanup([orgId, otherOrgId], [owner, member, viewer, outsider]);
});

describe("requestUpload", () => {
  it.each([
    ["an unsupported type", { mimeType: "application/zip" }, "Unsupported file type."],
    ["a file over 25 MB", { sizeBytes: 26_214_401 }, "File is larger than 25 MB."],
    ["an empty file", { sizeBytes: 0 }, "File is empty."],
  ])("rejects %s with a clear message", async (_label, extra, message) => {
    const res = await actions.requestUpload(meta(pdf("x"), extra));
    expect(res).toMatchObject({ ok: false, error: message });
  });

  it("refuses viewers", async () => {
    actAs(viewer);
    expect(await actions.requestUpload(meta(pdf("viewer")))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/permission/),
    });
  });

  it("creates an uploading document under {org}/documents/{id}/ with a safe file name", async () => {
    const res = await actions.requestUpload(meta(pdf("path"), { entityId }));
    expect(res.ok).toBe(true);
    const id = res.ok ? res.data.documentId : "";
    expect(await doc(id)).toMatchObject({
      status: "uploading",
      uploaded_by: member.id,
      entity_id: entityId,
      file_name: "Invoice #7.pdf",
      storage_path: `${orgId}/documents/${id}/Invoice-7.pdf`,
    });
    expect(enqueued()).toEqual([]);
  });

  it("cannot assign another org's entity", async () => {
    const res = await actions.requestUpload(meta(pdf("foreign"), { entityId: otherEntityId }));
    expect(res.ok).toBe(false);
  });
});

describe("confirmUpload", () => {
  it("refuses until the file is actually in storage", async () => {
    const ticket = await actions.requestUpload(meta(pdf("not uploaded")));
    const id = ticket.ok ? ticket.data.documentId : "";
    expect(await actions.confirmUpload({ documentId: id })).toMatchObject({ ok: false });
    expect((await doc(id))?.status).toBe("uploading");
  });

  it("refuses a truncated upload", async () => {
    const bytes = pdf("full contents");
    const ticket = await actions.requestUpload(meta(bytes));
    if (!ticket.ok) throw new Error();
    await put(ticket.data.uploadUrl, bytes.slice(0, 5));
    expect(await actions.confirmUpload({ documentId: ticket.data.documentId })).toEqual({
      ok: false,
      error: "The uploaded file is incomplete. Please try again.",
    });
  });

  it("queues the document and enqueues a valid process-document job (once)", async () => {
    const { ticket, confirmed } = await upload(pdf("happy path"));
    expect(confirmed).toEqual({ ok: true, data: { status: "queued" } });
    expect(await doc(ticket.documentId)).toMatchObject({ status: "queued", attempts: 1 });
    expect(enqueued()).toEqual([
      {
        queue: "process-document",
        payload: { orgId, documentId: ticket.documentId },
        jobId: `${ticket.documentId}-1`,
      },
    ]);
    // A second confirm (double click / retry) is a no-op.
    expect(await actions.confirmUpload({ documentId: ticket.documentId })).toEqual({
      ok: true,
      data: { status: "queued" },
    });
    expect(enqueued()).toHaveLength(2);
    expect(enqueued()[1].jobId).toBe(`${ticket.documentId}-1`); // same job id → deduplicated by BullMQ
  });

  it("flags a duplicate of an earlier upload", async () => {
    const bytes = pdf("same bytes");
    const first = await upload(bytes);
    const again = await actions.requestUpload(meta(bytes, { fileName: "copy.pdf" }));
    expect(again.ok && again.data.duplicateOf).toEqual({
      id: first.ticket.documentId,
      fileName: "Invoice #7.pdf",
    });
  });

  it("is invisible across orgs", async () => {
    const { ticket } = await upload(pdf("mine"));
    actAs(outsider);
    expect(await actions.confirmUpload({ documentId: ticket.documentId })).toEqual({
      ok: false,
      error: "Document not found.",
    });
    expect(await actions.retryDocument({ documentId: ticket.documentId })).toEqual({
      ok: false,
      error: "Document not found.",
    });
  });
});

describe("retryDocument", () => {
  it("re-queues a failed document as a new attempt", async () => {
    const { ticket } = await upload(pdf("will fail"));
    await admin.rpc("transition_document", {
      p_org: orgId,
      p_document: ticket.documentId,
      p_from: ["queued"],
      p_to: "failed",
    });
    resetEnqueued();
    expect(await actions.retryDocument({ documentId: ticket.documentId })).toEqual({
      ok: true,
      data: undefined,
    });
    expect(await doc(ticket.documentId)).toMatchObject({ status: "queued", attempts: 2, error: null });
    expect(enqueued()[0].jobId).toBe(`${ticket.documentId}-2`);
  });

  it("re-sends the job for a document stuck in queued, and refuses other states", async () => {
    const { ticket } = await upload(pdf("stuck"));
    resetEnqueued();
    expect((await actions.retryDocument({ documentId: ticket.documentId })).ok).toBe(true);
    expect(enqueued()[0].jobId).toBe(`${ticket.documentId}-1`);
    await admin.rpc("transition_document", {
      p_org: orgId,
      p_document: ticket.documentId,
      p_from: ["queued"],
      p_to: "ready",
    });
    expect(await actions.retryDocument({ documentId: ticket.documentId })).toEqual({
      ok: false,
      error: "Only failed documents can be retried.",
    });
  });
});
