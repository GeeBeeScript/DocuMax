import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  cleanup,
  createOrg,
  createUser,
  newInviteToken,
  pgClient,
  type TestUser,
} from "../helpers";

const admin = adminClient();
let owner: TestUser;
let orgId: string;

beforeAll(async () => {
  owner = await createUser("audit-owner");
  orgId = (await createOrg(owner, "Audit Org")).id;
});

afterAll(() => cleanup([orgId], [owner]));

async function entries(table: string, rowId: string) {
  const { data } = await admin
    .from("audit_log")
    .select("*")
    .eq("table_name", table)
    .eq("row_id", rowId)
    .order("id");
  return data ?? [];
}

describe("audit_row_change trigger", () => {
  it("records org creation and the owner membership with the actor", async () => {
    const [org] = await entries("organizations", orgId);
    expect(org).toMatchObject({ org_id: orgId, action: "insert", actor_id: owner.id, before: null });
    const { data: membership } = await admin.from("memberships").select("id").eq("org_id", orgId).single();
    const [m] = await entries("memberships", membership!.id);
    expect(m).toMatchObject({ action: "insert", actor_id: owner.id });
  });

  it("captures before/after/diff on update and skips no-op updates", async () => {
    await owner.client.from("organizations").update({ name: "Audit Org Renamed" }).eq("id", orgId);
    await owner.client.from("organizations").update({ name: "Audit Org Renamed" }).eq("id", orgId); // no-op
    const updates = (await entries("organizations", orgId)).filter((e) => e.action === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      actor_id: owner.id,
      diff: { name: "Audit Org Renamed" },
      before: expect.objectContaining({ name: "Audit Org" }),
      after: expect.objectContaining({ name: "Audit Org Renamed" }),
    });
  });

  it("captures deletes with the before image", async () => {
    const { data: invite } = await owner.client
      .from("invites")
      .insert({ org_id: orgId, email: "audited@example.test", token_hash: newInviteToken().hash })
      .select()
      .single();
    await owner.client.from("invites").delete().eq("id", invite!.id);
    const log = await entries("invites", invite!.id);
    expect(log.map((e) => e.action)).toEqual(["insert", "delete"]);
    expect(log[1]).toMatchObject({
      actor_id: owner.id,
      after: null,
      before: expect.objectContaining({ email: "audited@example.test" }),
    });
  });

  it("attributes automated changes to app.actor_id (worker)", async () => {
    const workerActor = "00000000-0000-4000-8000-000000000001";
    const pg = await pgClient();
    try {
      await pg.query("begin");
      await pg.query("select set_config('app.actor_id', $1, true)", [workerActor]);
      await pg.query("update public.organizations set review_threshold = 0.9 where id = $1", [orgId]);
      await pg.query("commit");
    } finally {
      await pg.end();
    }
    const last = (await entries("organizations", orgId)).at(-1);
    expect(last).toMatchObject({ action: "update", actor_id: workerActor, diff: { review_threshold: 0.9 } });
  });

  it("is append-only for end users, even owners", async () => {
    const [row] = await entries("organizations", orgId);
    const upd = await owner.client.from("audit_log").update({ action: "delete" }).eq("id", row.id).select();
    expect(upd.data).toEqual([]);
    const del = await owner.client.from("audit_log").delete().eq("id", row.id).select();
    expect(del.data).toEqual([]);
    expect((await entries("organizations", orgId))[0]).toEqual(row);
  });

  it("is readable by owners", async () => {
    const { data } = await owner.client.from("audit_log").select("id").eq("org_id", orgId);
    expect(data?.length).toBeGreaterThan(0);
  });
});
