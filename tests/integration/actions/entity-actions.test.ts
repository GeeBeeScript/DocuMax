import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMember, adminClient, cleanup, createOrg, createUser, type TestUser } from "../helpers";
import { actAs } from "../next-mocks";

const actions = await import("@/features/entities/actions");
const admin = adminClient();
let owner: TestUser, adminUser: TestUser, member: TestUser, outsider: TestUser;
let orgId: string, otherOrgId: string, otherEntity: string;

beforeAll(async () => {
  [owner, adminUser, member, outsider] = await Promise.all(
    ["ent-owner", "ent-admin", "ent-member", "ent-out"].map(createUser),
  );
  orgId = (await createOrg(owner, "Entity Org", "property")).id;
  otherOrgId = (await createOrg(outsider, "Other Entity Org", "job")).id;
  await addMember(orgId, adminUser, "admin");
  await addMember(orgId, member, "member");
  otherEntity = (
    await admin.from("entities").insert({ org_id: otherOrgId, kind: "job", name: "Theirs" }).select().single()
  ).data!.id;
});

afterAll(() => cleanup([orgId, otherOrgId], [owner, adminUser, member, outsider]));

const row = async (id: string) => (await admin.from("entities").select("*").eq("id", id).single()).data;

describe("entity actions", () => {
  it("validate input", async () => {
    actAs(owner);
    const res = await actions.createEntity({ name: " ", code: "x".repeat(41) });
    expect(res.ok).toBe(false);
    expect(!res.ok && Object.keys(res.fieldErrors ?? {})).toEqual(expect.arrayContaining(["name", "code"]));
  });

  it("owners and admins create entities of the org's kind; blank optionals become null", async () => {
    for (const u of [owner, adminUser]) {
      actAs(u);
      const res = await actions.createEntity({
        name: `By ${u.email.slice(0, 8)}`,
        code: "",
        address: " 1 Main St ",
      });
      expect(res.ok).toBe(true);
      const created = await row(res.ok ? res.data.id : "");
      expect(created).toMatchObject({ org_id: orgId, kind: "property", code: null, address: "1 Main St" });
    }
  });

  it("members cannot create, edit or archive", async () => {
    actAs(owner);
    const res = await actions.createEntity({ name: "Members can't touch" });
    const id = res.ok ? res.data.id : "";
    actAs(member);
    expect((await actions.createEntity({ name: "Nope" })).ok).toBe(false);
    expect((await actions.updateEntity({ id, name: "Changed" })).ok).toBe(false);
    expect((await actions.setEntityStatus({ id, status: "archived" })).ok).toBe(false);
    expect((await row(id))?.name).toBe("Members can't touch");
  });

  it("duplicate references get a field error", async () => {
    actAs(owner);
    await actions.createEntity({ name: "First", code: "ELM-1" });
    const res = await actions.createEntity({ name: "Second", code: "elm-1" });
    expect(res).toMatchObject({ ok: false, fieldErrors: { code: ["Already used."] } });
  });

  it("edits and archives/restores, audited with the actor", async () => {
    actAs(adminUser);
    const res = await actions.createEntity({ name: "Lifecycle" });
    const id = res.ok ? res.data.id : "";
    expect((await actions.updateEntity({ id, name: "Lifecycle 2", clientName: "Owner X" })).ok).toBe(true);
    expect((await actions.setEntityStatus({ id, status: "archived" })).ok).toBe(true);
    expect(await row(id)).toMatchObject({ name: "Lifecycle 2", client_name: "Owner X", status: "archived" });
    expect((await actions.setEntityStatus({ id, status: "active" })).ok).toBe(true);
    const { data } = await admin.from("audit_log").select("action, actor_id").eq("row_id", id).order("id");
    expect(data?.every((a) => a.actor_id === adminUser.id)).toBe(true);
    expect(data?.map((a) => a.action)).toEqual(["insert", "update", "update", "update"]);
  });

  it("cannot touch another org's entity", async () => {
    actAs(owner);
    expect(await actions.updateEntity({ id: otherEntity, name: "Hijack" })).toEqual({
      ok: false,
      error: "Not found.",
    });
    expect(await actions.setEntityStatus({ id: otherEntity, status: "archived" })).toEqual({
      ok: false,
      error: "Not found.",
    });
  });
});
