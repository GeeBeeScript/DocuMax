import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PLANS } from "@/lib/billing/plans";
import { addMember, adminClient, cleanup, createOrg, createUser, setPlan, type TestUser } from "../helpers";
import { actAs } from "../next-mocks";

const documents = await import("@/features/documents/actions");
const org = await import("@/features/org/actions");
const admin = adminClient();
let owner: TestUser, member: TestUser;
let freeOrg: string;

const period = async (orgId: string) =>
  (await admin.rpc("org_usage_period", { p_org: orgId })).data as string;
const setUsed = async (orgId: string, used: number) =>
  admin
    .from("usage_counters")
    .upsert(
      { org_id: orgId, period_start: await period(orgId), documents_used: used },
      { onConflict: "org_id,period_start" },
    );
const used = async (orgId: string) =>
  (
    await admin
      .from("usage_counters")
      .select("documents_used")
      .eq("org_id", orgId)
      .eq("period_start", await period(orgId))
      .maybeSingle()
  ).data?.documents_used ?? 0;
const upload = () =>
  documents.requestUpload({ fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 100 });

beforeAll(async () => {
  [owner, member] = await Promise.all(["bq-owner", "bq-member"].map(createUser));
  freeOrg = (await createOrg(owner, "Free Org", "property", { plan: "free" })).id;
  await addMember(freeOrg, member, "member"); // direct insert (seats are checked on invites)
});
afterAll(() => cleanup([freeOrg], [owner, member]));

describe("plan limits", () => {
  it("the database's plan_limits mirror lib/billing/plans.ts", async () => {
    const { data } = await admin.from("plan_limits").select("*").order("plan");
    expect(
      Object.fromEntries(data!.map((p) => [p.plan, { documents: p.documents_per_month, seats: p.seats }])),
    ).toEqual(
      Object.fromEntries(
        Object.values(PLANS).map((p) => [p.id, { documents: p.documentsPerMonth, seats: p.seats }]),
      ),
    );
  });

  it("org_usage reports plan, usage and seats; Stripe status decides the plan", async () => {
    await setUsed(freeOrg, 3);
    const read = async () => (await owner.client.rpc("org_usage", { p_org: freeOrg }).single()).data!;
    expect(await read()).toMatchObject({
      plan: "free",
      documents_used: 3,
      documents_cap: 25,
      seats_used: 2,
      seats_cap: 1,
    });
    await setPlan(freeOrg, "pro", "past_due"); // Stripe still retrying: keep the plan
    expect(await read()).toMatchObject({ plan: "pro", documents_cap: 500 });
    await setPlan(freeOrg, "pro", "canceled");
    expect(await read()).toMatchObject({ plan: "free" });
    await admin.from("subscriptions").delete().eq("org_id", freeOrg);
  });
});

describe("document quota", () => {
  it("parallel consumption never exceeds the cap", async () => {
    await setUsed(freeOrg, 20);
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        member.client.rpc("consume_document_quota", { p_org: freeOrg, p_count: 1 }),
      ),
    );
    expect(results.filter((r) => !r.error)).toHaveLength(5);
    expect(results.filter((r) => r.error?.message === "quota_exceeded")).toHaveLength(15);
    expect(await used(freeOrg)).toBe(25);
  });

  it("uploads past the cap are refused with a code and create nothing; a cancelled upload gives quota back", async () => {
    actAs(member);
    await setUsed(freeOrg, 24);
    const ok = await upload();
    expect(ok.ok).toBe(true);
    expect(await used(freeOrg)).toBe(25);
    expect(await upload()).toMatchObject({ ok: false, code: "quota_exceeded" });
    const { count } = await admin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("org_id", freeOrg);
    expect(count).toBe(1);

    expect(await documents.cancelUpload({ documentId: ok.ok ? ok.data.documentId : "" })).toEqual({
      ok: true,
      data: undefined,
    });
    expect(await used(freeOrg)).toBe(24);
    expect((await admin.from("documents").select("id").eq("org_id", freeOrg)).data).toEqual([]);
    expect((await upload()).ok).toBe(true); // room again
  });

  it("users can't release quota themselves", async () => {
    const { error } = await member.client.rpc(
      "release_document_quota" as never,
      { p_org: freeOrg, p_count: 100 } as never,
    );
    expect(error).not.toBeNull();
  });

  it("an upgrade raises the cap immediately", async () => {
    await setUsed(freeOrg, 25);
    actAs(member);
    expect((await upload()).ok).toBe(false);
    await setPlan(freeOrg, "pro");
    expect((await upload()).ok).toBe(true);
    await admin.from("subscriptions").delete().eq("org_id", freeOrg);
  });
});

describe("seats", () => {
  it("invites stop at the plan's seats with a clear message", async () => {
    actAs(owner);
    const res = await org.inviteMember({ email: "new-person@example.test", role: "member" });
    expect(res).toMatchObject({ ok: false, code: "seat_limit", error: expect.stringContaining("1 seat") });
    await setPlan(freeOrg, "pro");
    expect((await org.inviteMember({ email: "new-person@example.test", role: "member" })).ok).toBe(true);
    await admin.from("subscriptions").delete().eq("org_id", freeOrg);
  });
});
