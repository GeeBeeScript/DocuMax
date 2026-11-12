import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMember, adminClient, cleanup, createOrg, createUser, type TestUser } from "../helpers";
import { actAs, Redirect } from "../next-mocks";

const actions = await import("@/features/org/actions");
const admin = adminClient();
let owner: TestUser, adminUser: TestUser, other: TestUser;
let orgId: string, otherOrgId: string;
const pdf = () => new Blob(["%PDF-1.4 x"], { type: "application/pdf" });

beforeAll(async () => {
  [owner, adminUser, other] = await Promise.all(["del-owner", "del-admin", "del-other"].map(createUser));
  orgId = (await createOrg(owner, "Doomed Org")).id;
  otherOrgId = (await createOrg(other, "Survivor Org")).id;
  await addMember(orgId, adminUser, "admin");

  // Data in every corner: entity + record + allocation, files in several buckets (incl. worker-written reports).
  const [elm, oak] = await Promise.all(
    ["Elm", "Oak"].map(
      async (name) =>
        (await admin.from("entities").insert({ org_id: orgId, kind: "property", name }).select("id").single())
          .data!.id,
    ),
  );
  const record = (
    await admin
      .from("records")
      .insert({
        org_id: orgId,
        entity_id: elm,
        total_cents: 100,
        min_confidence: 1,
        field_confidence: {},
        status: "approved",
      })
      .select("id")
      .single()
  ).data!.id;
  await admin
    .from("allocations")
    .insert({ org_id: orgId, record_id: record, entity_id: oak, method: "percent", percent_bp: 10000 });
  await admin.storage.from("documents").upload(`${orgId}/documents/d1/a.pdf`, pdf());
  await admin.storage.from("documents").upload(`${orgId}/documents/d2/b.pdf`, pdf());
  await admin.storage.from("reports").upload(`${orgId}/reports/r1.pdf`, pdf());
  await admin.storage.from("documents").upload(`${otherOrgId}/documents/keep/c.pdf`, pdf());
});
afterAll(async () => {
  await admin.storage.from("documents").remove([`${otherOrgId}/documents/keep/c.pdf`]);
  await cleanup([orgId, otherOrgId], [owner, adminUser, other]);
});

const files = async (bucket: string, prefix: string) =>
  (await admin.storage.from(bucket).list(prefix)).data ?? [];

describe("deleteOrganization", () => {
  it("only owners, and only with the exact name", async () => {
    actAs(adminUser);
    expect((await actions.deleteOrganization({ confirmName: "Doomed Org" })).ok).toBe(false);
    actAs(owner);
    expect(await actions.deleteOrganization({ confirmName: "doomed org" })).toMatchObject({ ok: false });
    expect((await admin.from("organizations").select("id").eq("id", orgId)).data).toHaveLength(1);
  });

  it("removes every file and every row of the org, and nothing of others", async () => {
    actAs(owner);
    await expect(actions.deleteOrganization({ confirmName: "Doomed Org" })).rejects.toBeInstanceOf(Redirect);
    expect((await admin.from("organizations").select("id").eq("id", orgId)).data).toEqual([]);
    for (const table of ["entities", "records", "allocations", "memberships", "subscriptions"] as const) {
      expect((await admin.from(table).select("id").eq("org_id", orgId)).data).toEqual([]);
    }
    expect(await files("documents", `${orgId}/documents`)).toEqual([]);
    expect(await files("reports", `${orgId}/reports`)).toEqual([]);
    expect((await files("documents", `${otherOrgId}/documents/keep`)).map((f) => f.name)).toEqual(["c.pdf"]);
  });
});
