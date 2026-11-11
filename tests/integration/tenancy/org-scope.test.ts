import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { forOrg, OrgScopeError } from "@/lib/db/org-scope";
import { adminClient, cleanup, createOrg, createUser, newInviteToken, type TestUser } from "../helpers";

let a: TestUser, b: TestUser;
let orgA: string, orgB: string, inviteB: string;
const admin = adminClient();

beforeAll(async () => {
  a = await createUser("scope-a");
  b = await createUser("scope-b");
  orgA = (await createOrg(a, "Scope A")).id;
  orgB = (await createOrg(b, "Scope B")).id;
  const { data } = await admin
    .from("invites")
    .insert({ org_id: orgB, email: "scoped@example.test", token_hash: newInviteToken().hash })
    .select()
    .single();
  inviteB = data!.id;
});

afterAll(() => cleanup([orgA, orgB], [a, b]));

describe("forOrg (service-role repository)", () => {
  it("rejects a non-uuid org id", () => {
    expect(() => forOrg(admin, "not-a-uuid")).toThrow();
  });

  it("select only returns the org's rows", async () => {
    const { data } = await forOrg(admin, orgA).select("memberships", "org_id");
    expect(data?.length).toBeGreaterThan(0);
    expect(new Set((data as unknown as { org_id: string }[]).map((r) => r.org_id))).toEqual(new Set([orgA]));
  });

  it("requireRow throws on a cross-org row", async () => {
    await expect(forOrg(admin, orgA).requireRow("invites", inviteB)).rejects.toBeInstanceOf(OrgScopeError);
    await expect(forOrg(admin, orgB).requireRow("invites", inviteB)).resolves.toMatchObject({ org_id: orgB });
  });

  it("assertOwned throws when any row belongs to another org", () => {
    expect(() => forOrg(admin, orgA).assertOwned([{ org_id: orgA }, { org_id: orgB }])).toThrow(
      OrgScopeError,
    );
  });

  it("insert stamps org_id; update/delete cannot touch other orgs", async () => {
    const scope = forOrg(admin, orgA);
    const ins = await scope
      .insert("invites", [{ email: "stamped@example.test", token_hash: newInviteToken().hash }])
      .select();
    expect((ins.data as { org_id: string }[])[0].org_id).toBe(orgA);

    const upd = await scope.update("invites", { role: "admin" }).eq("id", inviteB).select();
    expect(upd.data).toEqual([]);
    const del = await scope.delete("invites").eq("id", inviteB).select();
    expect(del.data).toEqual([]);
  });
});
