/** Database guarantees for entities/documents beyond tenant isolation (status machine, grants, limits). */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMember, adminClient, cleanup, createOrg, createUser, type TestUser } from "../helpers";

const admin = adminClient();
let owner: TestUser, member: TestUser, viewer: TestUser, outsider: TestUser;
let orgId: string, otherOrgId: string, otherEntityId: string;

async function newDocument(user: TestUser, overrides: Record<string, unknown> = {}) {
  const id = randomUUID();
  const { data, error } = await user.client
    .from("documents")
    .insert({
      id,
      org_id: orgId,
      uploaded_by: user.id,
      storage_path: `${orgId}/documents/${id}/invoice.pdf`,
      file_name: "invoice.pdf",
      mime_type: "application/pdf",
      size_bytes: 2048,
      ...overrides,
    })
    .select()
    .single();
  return { id, data, error };
}
const statusOf = async (id: string) =>
  (await admin.from("documents").select("status, attempts, error").eq("id", id).single()).data;

beforeAll(async () => {
  [owner, member, viewer, outsider] = await Promise.all(
    ["doc-owner", "doc-member", "doc-viewer", "doc-out"].map(createUser),
  );
  orgId = (await createOrg(owner, "Docs Org", "job")).id;
  otherOrgId = (await createOrg(outsider, "Other Docs Org")).id;
  await addMember(orgId, member, "member");
  await addMember(orgId, viewer, "viewer");
  const { data } = await admin
    .from("entities")
    .insert({ org_id: otherOrgId, kind: "property", name: "Theirs" })
    .select()
    .single();
  otherEntityId = data!.id;
});

afterAll(() => cleanup([orgId, otherOrgId], [owner, member, viewer, outsider]));

describe("entities", () => {
  it("take their kind from the organization, whatever the client sends", async () => {
    const { data } = await owner.client
      .from("entities")
      .insert({ org_id: orgId, kind: "property", name: "Job 1" })
      .select()
      .single();
    expect(data?.kind).toBe("job");
  });

  it("only owners/admins manage them; members can read", async () => {
    const { error } = await member.client
      .from("entities")
      .insert({ org_id: orgId, kind: "job", name: "Nope" });
    expect(error?.code).toBe("42501");
    const { data } = await member.client.from("entities").select("id").eq("org_id", orgId);
    expect(data?.length).toBeGreaterThan(0);
  });

  it("codes are unique per org, case-insensitively", async () => {
    await owner.client.from("entities").insert({ org_id: orgId, kind: "job", name: "A", code: "J-100" });
    const { error } = await owner.client
      .from("entities")
      .insert({ org_id: orgId, kind: "job", name: "B", code: "j-100" });
    expect(error?.code).toBe("23505");
  });
});

describe("documents", () => {
  it("members can create an uploading document under the org prefix", async () => {
    const { data, error } = await newDocument(member);
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "uploading", attempts: 0, uploaded_by: member.id });
  });

  it("viewers cannot create documents", async () => {
    expect((await newDocument(viewer)).error?.code).toBe("42501");
  });

  it.each([
    ["a status other than uploading", { status: "ready" }],
    ["someone else as uploader", { uploaded_by: "00000000-0000-4000-8000-000000000009" }],
  ])("cannot be inserted with %s", async (_label, overrides) => {
    expect((await newDocument(member, overrides)).error?.code).toBe("42501");
  });

  it("must live under {org_id}/documents/{id}/", async () => {
    const { error } = await newDocument(member, { storage_path: `${otherOrgId}/documents/x/evil.pdf` });
    expect(error?.code).toBe("23514");
  });

  it("rejects unsupported types and files over 25 MB", async () => {
    expect((await newDocument(member, { mime_type: "application/zip" })).error?.code).toBe("23514");
    expect((await newDocument(member, { size_bytes: 26_214_401 })).error?.code).toBe("23514");
  });

  it("users cannot set status or processing fields directly", async () => {
    const { id } = await newDocument(member);
    const { error } = await owner.client.from("documents").update({ status: "ready" }).eq("id", id);
    expect(error?.code).toBe("42501");
    expect((await statusOf(id))?.status).toBe("uploading");
  });

  it("can only be assigned to an entity of the same org", async () => {
    const { id } = await newDocument(member);
    const { error } = await member.client.from("documents").update({ entity_id: otherEntityId }).eq("id", id);
    expect(error?.code).toBe("42501");
  });

  it("confirm_document_upload moves uploading → queued once (idempotent)", async () => {
    const { id } = await newDocument(member);
    expect((await member.client.rpc("confirm_document_upload", { p_document: id })).data?.status).toBe(
      "queued",
    );
    await member.client.rpc("confirm_document_upload", { p_document: id });
    expect(await statusOf(id)).toMatchObject({ status: "queued", attempts: 1 });
  });

  it("confirm_document_upload is refused for viewers and other orgs", async () => {
    const { id } = await newDocument(member);
    expect((await viewer.client.rpc("confirm_document_upload", { p_document: id })).error).not.toBeNull();
    expect((await outsider.client.rpc("confirm_document_upload", { p_document: id })).error).not.toBeNull();
    expect((await statusOf(id))?.status).toBe("uploading");
  });

  it("transition_document is service-role only and checks the current status", async () => {
    const { id } = await newDocument(member);
    await member.client.rpc("confirm_document_upload", { p_document: id });
    const userCall = await owner.client.rpc("transition_document", {
      p_org: orgId,
      p_document: id,
      p_from: ["queued"],
      p_to: "ready",
    });
    expect(userCall.error).not.toBeNull();

    const wrongOrg = await admin.rpc("transition_document", {
      p_org: otherOrgId,
      p_document: id,
      p_from: ["queued"],
      p_to: "extracting",
    });
    expect(wrongOrg.data?.id ?? null).toBeNull();
    const ok = await admin.rpc("transition_document", {
      p_org: orgId,
      p_document: id,
      p_from: ["queued"],
      p_to: "extracting",
    });
    expect(ok.data?.status).toBe("extracting");
    const stale = await admin.rpc("transition_document", {
      p_org: orgId,
      p_document: id,
      p_from: ["queued"],
      p_to: "extracting",
    });
    expect(stale.data?.id ?? null).toBeNull();
  });

  it("worker transitions are audited to the worker actor; failures keep an error; retry re-queues", async () => {
    const { id } = await newDocument(member);
    await member.client.rpc("confirm_document_upload", { p_document: id });
    await admin.rpc("transition_document", {
      p_org: orgId,
      p_document: id,
      p_from: ["queued"],
      p_to: "failed",
      p_error: "boom",
    });
    expect(await statusOf(id)).toMatchObject({ status: "failed", error: "boom" });
    const { data: audit } = await admin
      .from("audit_log")
      .select("actor_id, diff")
      .eq("row_id", id)
      .eq("action", "update")
      .order("id", { ascending: false })
      .limit(1)
      .single();
    expect(audit).toMatchObject({
      actor_id: "00000000-0000-0000-0000-000000000000",
      diff: { status: "failed" },
    });

    expect((await viewer.client.rpc("retry_document", { p_document: id })).error).not.toBeNull();
    expect((await member.client.rpc("retry_document", { p_document: id })).data?.status).toBe("queued");
    expect(await statusOf(id)).toMatchObject({ status: "queued", attempts: 2, error: null });
    expect((await member.client.rpc("retry_document", { p_document: id })).error?.message).toMatch(
      /only failed/,
    );
  });
});

describe("documents bucket limits", () => {
  it("rejects disallowed types and oversized files at the storage layer", async () => {
    const zip = await member.client.storage
      .from("documents")
      .upload(`${orgId}/documents/${randomUUID()}/a.zip`, new Blob(["x"], { type: "application/zip" }));
    expect(zip.error).not.toBeNull();
    const big = await member.client.storage
      .from("documents")
      .upload(
        `${orgId}/documents/${randomUUID()}/big.pdf`,
        new Blob([new Uint8Array(26_214_401)], { type: "application/pdf" }),
      );
    expect(big.error).not.toBeNull();
  });
});
