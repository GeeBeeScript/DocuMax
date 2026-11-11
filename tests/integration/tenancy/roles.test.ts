/** Role matrix for membership and invite management (enforced by RLS + guard triggers). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addMember,
  adminClient,
  cleanup,
  createOrg,
  createUser,
  newInviteToken,
  type OrgRole,
  type TestUser,
} from "../helpers";

const ROLES: OrgRole[] = ["owner", "admin", "reviewer", "member", "viewer"];
const MANAGERS: OrgRole[] = ["owner", "admin"];
const admin = adminClient();

const users = {} as Record<OrgRole, TestUser>;
let orgId: string;
let target: TestUser; // a plain member each test tries to manage

beforeAll(async () => {
  users.owner = await createUser("role-owner");
  orgId = (await createOrg(users.owner, "Roles Org")).id;
  for (const role of ROLES.filter((r) => r !== "owner")) {
    users[role] = await createUser(`role-${role}`);
    await addMember(orgId, users[role], role);
  }
  target = await createUser("role-target");
  await addMember(orgId, target, "member");
});

afterAll(() => cleanup([orgId], [...Object.values(users), target]));

async function roleOf(user: TestUser) {
  const { data } = await admin
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .single();
  return data?.role;
}
const resetTarget = () =>
  admin.from("memberships").update({ role: "member" }).eq("org_id", orgId).eq("user_id", target.id);

describe.each(ROLES)("as %s", (role) => {
  const canManage = MANAGERS.includes(role);

  it(`${canManage ? "can" : "cannot"} see invites`, async () => {
    const seeded = await admin
      .from("invites")
      .insert({ org_id: orgId, email: `seen-by-${role}@example.test`, token_hash: newInviteToken().hash })
      .select()
      .single();
    const { data } = await users[role].client.from("invites").select("id").eq("id", seeded.data!.id);
    expect(data?.length).toBe(canManage ? 1 : 0);
  });

  it(`${canManage ? "can" : "cannot"} create invites`, async () => {
    const { error } = await users[role].client.from("invites").insert({
      org_id: orgId,
      email: `by-${role}@example.test`,
      role: "member",
      token_hash: newInviteToken().hash,
    });
    expect(error === null).toBe(canManage);
  });

  it(`${canManage ? "can" : "cannot"} change a member's role`, async () => {
    await resetTarget();
    await users[role].client
      .from("memberships")
      .update({ role: "reviewer" })
      .eq("org_id", orgId)
      .eq("user_id", target.id);
    expect(await roleOf(target)).toBe(canManage ? "reviewer" : "member");
  });

  it(`${canManage ? "can" : "cannot"} remove a member`, async () => {
    const extra = await createUser(`role-extra-${role}`);
    await addMember(orgId, extra, "viewer");
    await users[role].client.from("memberships").delete().eq("org_id", orgId).eq("user_id", extra.id);
    expect(await roleOf(extra)).toBe(canManage ? undefined : "viewer");
    await cleanup([], [extra]);
  });

  it(`${role === "owner" ? "can" : "cannot"} grant the owner role`, async () => {
    await resetTarget();
    await users[role].client
      .from("memberships")
      .update({ role: "owner" })
      .eq("org_id", orgId)
      .eq("user_id", target.id);
    expect(await roleOf(target)).toBe(role === "owner" ? "owner" : "member");
    await resetTarget();
  });
});

describe("owner protections", () => {
  it("admins cannot demote or remove an owner", async () => {
    await users.admin.client
      .from("memberships")
      .update({ role: "viewer" })
      .eq("org_id", orgId)
      .eq("user_id", users.owner.id);
    await users.admin.client.from("memberships").delete().eq("org_id", orgId).eq("user_id", users.owner.id);
    expect(await roleOf(users.owner)).toBe("owner");
  });

  it("invites can never grant the owner role", async () => {
    const { error } = await users.owner.client.from("invites").insert({
      org_id: orgId,
      email: "owner-invite@example.test",
      role: "owner",
      token_hash: newInviteToken().hash,
    });
    expect(error).not.toBeNull();
  });

  it("the last owner cannot leave or be demoted", async () => {
    const leave = await users.owner.client
      .from("memberships")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", users.owner.id);
    expect(leave.error?.message).toMatch(/at least one owner/);
    const demote = await users.owner.client
      .from("memberships")
      .update({ role: "admin" })
      .eq("org_id", orgId)
      .eq("user_id", users.owner.id);
    expect(demote.error?.message).toMatch(/at least one owner/);
    expect(await roleOf(users.owner)).toBe("owner");
  });

  it("any member can leave an org", async () => {
    const leaver = await createUser("role-leaver");
    await addMember(orgId, leaver, "viewer");
    const { error } = await leaver.client
      .from("memberships")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", leaver.id);
    expect(error).toBeNull();
    expect(await roleOf(leaver)).toBeUndefined();
    await cleanup([], [leaver]);
  });

  it("only owners can delete the organization", async () => {
    const del = await users.admin.client.from("organizations").delete().eq("id", orgId).select();
    expect(del.data).toEqual([]);
  });
});
