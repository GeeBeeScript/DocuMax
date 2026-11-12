import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, cleanup, createOrg, createUser, addMember, type TestUser } from "../helpers";

const BUCKETS = ["documents", "reports", "imports", "branding"] as const;
type Bucket = (typeof BUCKETS)[number];
/** Who may write each bucket (docs/MULTI_TENANCY.md): reports only by the worker, branding by owners/admins. */
const WRITERS: Record<Bucket, "members" | "admins" | "worker"> = {
  documents: "members",
  imports: "members",
  branding: "admins",
  reports: "worker",
};
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const file = (bucket: Bucket) =>
  bucket === "branding"
    ? new Blob([PNG], { type: "image/png" })
    : new Blob(["%PDF-1.4 test"], { type: "application/pdf" });

let a: TestUser, b: TestUser, viewer: TestUser, member: TestUser;
let orgA: string, orgB: string;

beforeAll(async () => {
  a = await createUser("st-a");
  b = await createUser("st-b");
  viewer = await createUser("st-viewer");
  member = await createUser("st-member");
  orgA = (await createOrg(a, "Storage A")).id;
  orgB = (await createOrg(b, "Storage B")).id;
  await addMember(orgA, viewer, "viewer");
  await addMember(orgA, member, "member");
});

afterAll(async () => {
  const admin = adminClient();
  for (const bucket of BUCKETS) {
    for (const org of [orgA, orgB]) {
      const { data } = await admin.storage.from(bucket).list(`${org}/docs`);
      if (data?.length) await admin.storage.from(bucket).remove(data.map((f) => `${org}/docs/${f.name}`));
    }
  }
  await cleanup([orgA, orgB], [a, b, viewer, member]);
});

describe.each(BUCKETS)("storage bucket %s", (bucket) => {
  it("buckets are private", async () => {
    const { data } = await adminClient().storage.getBucket(bucket);
    expect(data?.public).toBe(false);
  });

  it("allowed writers can upload under their own org prefix; others can't", async () => {
    if (WRITERS[bucket] === "worker") {
      const own = await a.client.storage.from(bucket).upload(`${orgA}/docs/x.pdf`, file(bucket));
      expect(own.error).not.toBeNull(); // even owners: only the worker writes reports
      for (const [org, name] of [
        [orgA, "a.pdf"],
        [orgB, "b.pdf"],
      ] as const) {
        const seeded = await adminClient()
          .storage.from(bucket)
          .upload(`${org}/docs/${name}`, file(bucket), { upsert: true });
        expect(seeded.error).toBeNull();
      }
      return;
    }
    const own = await a.client.storage
      .from(bucket)
      .upload(`${orgA}/docs/a.pdf`, file(bucket), { upsert: true });
    expect(own.error).toBeNull();
    const other = await b.client.storage
      .from(bucket)
      .upload(`${orgB}/docs/b.pdf`, file(bucket), { upsert: true });
    expect(other.error).toBeNull();
    const byMember = await member.client.storage
      .from(bucket)
      .upload(`${orgA}/docs/m.pdf`, file(bucket), { upsert: true });
    expect(byMember.error === null).toBe(WRITERS[bucket] === "members");
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
    const intoB = await a.client.storage.from(bucket).upload(`${orgB}/docs/evil.pdf`, file(bucket));
    expect(intoB.error).not.toBeNull();
    const noPrefix = await a.client.storage.from(bucket).upload(`docs/evil.pdf`, file(bucket));
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
    const up = await viewer.client.storage.from(bucket).upload(`${orgA}/docs/v.pdf`, file(bucket));
    expect(up.error).not.toBeNull();
  });
});
