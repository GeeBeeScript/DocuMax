import { describe, expect, it } from "vitest";
import { purgePrefix, type StorageBucketLike } from "./purge";

function fakeBucket(paths: string[]): StorageBucketLike & { paths: Set<string> } {
  const all = new Set(paths);
  return {
    paths: all,
    async list(prefix, { limit, offset }) {
      const children = new Map<string, string | null>();
      for (const p of all) {
        if (!p.startsWith(`${prefix}/`)) continue;
        const [first, ...rest] = p.slice(prefix.length + 1).split("/");
        children.set(first!, rest.length ? null : "file");
      }
      const items = [...children].map(([name, id]) => ({ name, id }));
      return { data: items.slice(offset, offset + limit), error: null };
    },
    async remove(list) {
      list.forEach((p) => all.delete(p));
      return { error: null };
    },
  };
}

describe("purgePrefix", () => {
  it("removes every nested object under the prefix and nothing else", async () => {
    const files = [
      ...Array.from({ length: 1205 }, (_, i) => `org1/documents/d${i}/f.pdf`),
      "org1/reports/r1.pdf",
      "org1/batches/b1.zip",
      "org2/documents/x/f.pdf",
    ];
    const bucket = fakeBucket(files);
    expect(await purgePrefix(bucket, "org1/")).toBe(1207);
    expect([...bucket.paths]).toEqual(["org2/documents/x/f.pdf"]);
  });
});
