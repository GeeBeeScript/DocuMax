/**
 * Org Server Actions against local Supabase, running as real users (Next plumbing mocked in ../next-mocks.ts).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addMember, adminClient, cleanup, createOrg, createUser, type TestUser } from "../helpers";
import { actAs } from "../next-mocks";

const actions = await import("@/features/org/actions");
const admin = adminClient();
const as = (u: TestUser) => actAs(u);

let owner: TestUser,
  adminUser: TestUser,
  viewer: TestUser,
  member: TestUser,
  outsider: TestUser,
  newcomer: TestUser;
let orgId: string, otherOrgId: string;
const extraOrgs: string[] = [];

async function membershipId(user: TestUser, org = orgId) {
  const { data } = await admin
    .from("memberships")
    .select("id")
    .eq("org_id", org)
    .eq("user_id", user.id)
    .single();
  return data!.id;
}
async function roleOf(user: TestUser) {
  const { data } = await admin
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.role;
}

beforeAll(async () => {
  [owner, adminUser, viewer, member, outsider, newcomer] = await Promise.all(
    ["act-owner", "act-admin", "act-viewer", "act-member", "act-outsider", "act-newcomer"].map(createUser),
  );
  orgId = (await createOrg(owner, "Actions Org")).id;
  otherOrgId = (await createOrg(outsider, "Other Org")).id;
  await addMember(orgId, adminUser, "admin");
  await addMember(orgId, viewer, "viewer");
  await addMember(orgId, member, "member");
});

afterAll(() =>
  cleanup([orgId, otherOrgId, ...extraOrgs], [owner, adminUser, viewer, member, outsider, newcomer]),
);
beforeEach(() => as(owner));

describe("createOrganization", () => {
  it("validates input", async () => {
    as(newcomer);
    const res = await actions.createOrganization({ name: "x", entityKind: "boat" });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.fieldErrors).toMatchObject({
      name: expect.any(Array),
      entityKind: expect.any(Array),
    });
  });

  it("creates the org with the caller as owner, then continues onboarding", async () => {
    as(newcomer);
    await expect(
      actions.createOrganization({ name: "Newcomer Trades", entityKind: "job" }),
    ).rejects.toMatchObject({
      url: "/onboarding/invite",
    });
    const { data } = await admin
      .from("organizations")
      .select("id, entity_kind")
      .eq("created_by", newcomer.id)
      .single();
    extraOrgs.push(data!.id);
    expect(data!.entity_kind).toBe("job");
    const { data: audit } = await admin.from("audit_log").select("actor_id").eq("row_id", data!.id).single();
    expect(audit?.actor_id).toBe(newcomer.id);
  });
});

describe("inviteMember", () => {
  it("lets owners and admins create a one-time invite link", async () => {
    for (const u of [owner, adminUser]) {
      as(u);
      const res = await actions.inviteMember({
        email: `Invitee-${u.id.slice(0, 4)}@Example.test`,
        role: "reviewer",
      });
      expect(res.ok).toBe(true);
      expect(res.ok && res.data.inviteUrl).toMatch(/\/invite\/[A-Za-z0-9_-]{32}$/);
    }
    const { data } = await admin.from("invites").select("email, role, invited_by").eq("org_id", orgId);
    expect(data).toEqual(
      expect.arrayContaining([
        { email: `invitee-${owner.id.slice(0, 4)}@example.test`, role: "reviewer", invited_by: owner.id },
      ]),
    );
  });

  it("refuses members and viewers", async () => {
    for (const u of [member, viewer]) {
      as(u);
      const res = await actions.inviteMember({ email: "nope@example.test", role: "member" });
      expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/permission/) });
    }
  });

  it("never invites owners", async () => {
    const res = await actions.inviteMember({ email: "boss@example.test", role: "owner" });
    expect(res.ok).toBe(false);
  });

  it("invite → accept round trip adds the member", async () => {
    const res = await actions.inviteMember({ email: outsider.email, role: "viewer" });
    const token = res.ok ? res.data.inviteUrl.split("/").at(-1)! : "";
    as(outsider);
    await expect(actions.acceptInvite({ token })).rejects.toMatchObject({ url: "/app" });
    expect(await roleOf(outsider)).toBe("viewer");
  });

  it("accepting someone else's invite fails with a clear message", async () => {
    const res = await actions.inviteMember({ email: "someone@example.test", role: "member" });
    const token = res.ok ? res.data.inviteUrl.split("/").at(-1)! : "";
    as(member);
    expect(await actions.acceptInvite({ token })).toEqual({
      ok: false,
      error: "This invite was sent to a different email address.",
    });
  });
});

describe("changeMemberRole", () => {
  it("admins can change non-owner roles but cannot grant owner", async () => {
    as(adminUser);
    expect(
      await actions.changeMemberRole({ membershipId: await membershipId(member), role: "reviewer" }),
    ).toEqual({
      ok: true,
      data: undefined,
    });
    expect(await roleOf(member)).toBe("reviewer");
    expect(
      (await actions.changeMemberRole({ membershipId: await membershipId(member), role: "owner" })).ok,
    ).toBe(false);
    expect(await roleOf(member)).toBe("reviewer");
  });

  it("cannot touch memberships of another org", async () => {
    const res = await actions.changeMemberRole({
      membershipId: await membershipId(outsider, otherOrgId),
      role: "viewer",
    });
    expect(res).toEqual({ ok: false, error: "Member not found." });
  });

  it("the last owner cannot step down", async () => {
    const res = await actions.changeMemberRole({ membershipId: await membershipId(owner), role: "admin" });
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/at least one owner/) });
  });
});

describe("removeMember", () => {
  it("viewers cannot remove others, but can leave", async () => {
    as(viewer);
    expect((await actions.removeMember({ membershipId: await membershipId(member) })).ok).toBe(false);
    expect(await roleOf(member)).toBeDefined();
    await expect(actions.removeMember({ membershipId: await membershipId(viewer) })).rejects.toMatchObject({
      url: "/app",
    });
    expect(await roleOf(viewer)).toBeUndefined();
  });

  it("admins can remove members; the change is audited with the actor", async () => {
    as(adminUser);
    const id = await membershipId(member);
    expect((await actions.removeMember({ membershipId: id })).ok).toBe(true);
    const { data } = await admin
      .from("audit_log")
      .select("action, actor_id")
      .eq("row_id", id)
      .eq("action", "delete")
      .single();
    expect(data).toEqual({ action: "delete", actor_id: adminUser.id });
  });
});

describe("revokeInvite / setActiveOrg", () => {
  it("revokes an open invite", async () => {
    await actions.inviteMember({ email: "revoke-me@example.test", role: "member" });
    const { data } = await admin.from("invites").select("id").eq("email", "revoke-me@example.test").single();
    expect((await actions.revokeInvite({ inviteId: data!.id })).ok).toBe(true);
    const { data: after } = await admin.from("invites").select("id").eq("id", data!.id);
    expect(after).toEqual([]);
  });

  it("switches only to orgs the user belongs to", async () => {
    as(outsider); // member of both orgs after accepting the invite above
    expect((await actions.setActiveOrg({ orgId })).ok).toBe(true);
    as(owner);
    expect((await actions.setActiveOrg({ orgId: otherOrgId })).ok).toBe(false);
  });
});
