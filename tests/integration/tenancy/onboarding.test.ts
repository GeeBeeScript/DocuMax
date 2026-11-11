/** create_organization, accept_invite and invite_preview RPCs. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  cleanup,
  createOrg,
  createUser,
  newInviteToken,
  type TestUser,
} from "../helpers";

const admin = adminClient();
const orgs: string[] = [];
const people: TestUser[] = [];
let owner: TestUser;
let orgId: string;

async function user(label: string) {
  const u = await createUser(label);
  people.push(u);
  return u;
}

async function invite(
  email: string,
  overrides: { expires_at?: string; role?: "admin" | "member" | "viewer" } = {},
) {
  const { token, hash } = newInviteToken();
  const { error } = await owner.client.from("invites").insert({
    org_id: orgId,
    email,
    token_hash: hash,
    role: overrides.role ?? "member",
    expires_at: overrides.expires_at,
  });
  if (error) throw error;
  return token;
}

beforeAll(async () => {
  owner = await user("onb-owner");
  const org = await createOrg(owner, "Harbor & Pine PM");
  orgId = org.id;
  orgs.push(orgId);
});

afterAll(() => cleanup(orgs, people));

describe("create_organization", () => {
  it("makes the caller owner, slugifies the name and sets the active org", async () => {
    const { data: org } = await admin.from("organizations").select("*").eq("id", orgId).single();
    expect(org).toMatchObject({ slug: "harbor-pine-pm", entity_kind: "property", created_by: owner.id });
    const { data: m } = await admin
      .from("memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", owner.id)
      .single();
    expect(m?.role).toBe("owner");
    const { data: profile } = await admin.from("profiles").select("last_org_id").eq("id", owner.id).single();
    expect(profile?.last_org_id).toBe(orgId);
  });

  it("de-duplicates slugs", async () => {
    const other = await user("onb-dup");
    const org = await createOrg(other, "Harbor & Pine PM", "job");
    orgs.push(org.id);
    expect(org.slug).toBe("harbor-pine-pm-2");
  });

  it("is not callable anonymously", async () => {
    const { error } = await anonClient().rpc("create_organization", { p_name: "Anon", p_entity_kind: "job" });
    expect(error).not.toBeNull();
  });
});

describe("accept_invite", () => {
  it("adds the invitee with the invited role, once", async () => {
    const invitee = await user("onb-invitee");
    const token = await invite(invitee.email, { role: "admin" });
    const { data, error } = await invitee.client.rpc("accept_invite", { p_token: token });
    expect(error).toBeNull();
    expect(data).toBe(orgId);
    const { data: m } = await admin
      .from("memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", invitee.id)
      .single();
    expect(m?.role).toBe("admin");

    const again = await invitee.client.rpc("accept_invite", { p_token: token });
    expect(again.error?.message).toMatch(/invalid or has expired/);
  });

  it("rejects a different signed-in email", async () => {
    const stranger = await user("onb-stranger");
    const token = await invite("someone-else@example.test");
    const { error } = await stranger.client.rpc("accept_invite", { p_token: token });
    expect(error?.message).toMatch(/different email/);
  });

  it("rejects expired and unknown tokens", async () => {
    const late = await user("onb-late");
    const token = await invite(late.email, { expires_at: new Date(Date.now() - 60_000).toISOString() });
    expect((await late.client.rpc("accept_invite", { p_token: token })).error).not.toBeNull();
    expect((await late.client.rpc("accept_invite", { p_token: "nope" })).error).not.toBeNull();
  });

  it("invite_preview reveals only org name, role and email for a valid token", async () => {
    const token = await invite("preview@example.test", { role: "viewer" });
    const { data } = await anonClient().rpc("invite_preview", { p_token: token });
    expect(data).toEqual([
      {
        org_name: "Harbor & Pine PM",
        role: "viewer",
        email: "preview@example.test",
        expired: false,
        accepted: false,
      },
    ]);
    const none = await anonClient().rpc("invite_preview", { p_token: "unknown" });
    expect(none.data).toEqual([]);
  });
});

describe("profiles", () => {
  it("are created from auth users with name and lower-cased email", async () => {
    const { data } = await admin.from("profiles").select("email, full_name").eq("id", owner.id).single();
    expect(data).toEqual({ email: owner.email.toLowerCase(), full_name: "Test onb-owner" });
  });
});
