import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, cleanup, createOrg, createUser, addMember, type TestUser } from "../helpers";

const BUCKETS = ["documents", "reports", "imports", "branding"] as const;
const file = () => new Blob(["%PDF-1.4 test"], { type: "application/pdf" });

let a: TestUser, b: TestUser, viewer: TestUser;
let orgA: string, orgB: string;

beforeAll(async () => {
  a = await createUser("st-a");
  b = await createUser("st-b");
  viewer = await createUser("st-viewer");
  orgA = (await createOrg(a, "Storage A")).id;
  orgB = (await createOrg(b, "Storage B")).id;
  await addMember(orgA, viewer, "viewer");
});

afterAll(async () => {
  const admin = adminClient();
  for (const bucket of BUCKETS) {
    for (const org of [orgA, orgB]) {
      const { data } = await admin.storage.from(bucket).list(`${org}/docs`);
      if (data?.length) await admin.storage.from(bucket).remove(data.map((f) => `${org}/docs/${f.name}`));
    }
  }
  await cleanup([orgA, orgB], [a, b, viewer]);
});

describe.each(BUCKETS)("storage bucket %s", (bucket) => {
  it("buckets are private", async () => {
    const { data } = await adminClient().storage.getBucket(bucket);
    expect(data?.public).toBe(false);
  });

  it("members can upload under their own org prefix", async () => {
    const own = await a.client.storage.from(bucket).upload(`${orgA}/docs/a.pdf`, file(), { upsert: true });
    expect(own.error).toBeNull();
    const other = await b.client.storage.from(bucket).upload(`${orgB}/docs/b.pdf`, file(), { upsert: true });
    expect(other.error).toBeNull();
  });

  it("user A cannot list Org B objects", async () => {
    const { data } = await a.client.storage.from(bucket).list(`${orgB}/docs`);
    expect(data ?? []).toEqual([]);
  });

  it("user A cannot download Org B objects or sign URLs for them", async () => {
    const dl = await a.client.storage.from(bucket).download(`${orgB}/docs/b.pdf`);
    expect(dl.data).toBeNull();
    const signed = await a.client.storage.from(bucket).createSignedUrl(`${orgB}/docs/b.pdf`, 60);
    expect(signed.data).toBeNull();
  });

  it("user A cannot upload into Org B or outside any org prefix", async () => {
    const intoB = await a.client.storage.from(bucket).upload(`${orgB}/docs/evil.pdf`, file());
    expect(intoB.error).not.toBeNull();
    const noPrefix = await a.client.storage.from(bucket).upload(`docs/evil.pdf`, file());
    expect(noPrefix.error).not.toBeNull();
  });

  it("user A cannot delete Org B objects", async () => {
    await a.client.storage.from(bucket).remove([`${orgB}/docs/b.pdf`]);
    const { data } = await adminClient().storage.from(bucket).list(`${orgB}/docs`);
    expect(data?.map((f) => f.name)).toContain("b.pdf");
  });

  it("viewer can read but not upload in their own org", async () => {
    const dl = await viewer.client.storage.from(bucket).download(`${orgA}/docs/a.pdf`);
    expect(dl.error).toBeNull();
    const up = await viewer.client.storage.from(bucket).upload(`${orgA}/docs/v.pdf`, file());
    expect(up.error).not.toBeNull();
  });
});
