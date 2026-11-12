import { describe, expect, it } from "vitest";
import { buildContext, buildRecord } from "../test-builders";
import { duplicateFile } from "./duplicate-file";

describe("duplicate_file", () => {
  it("flags an error naming the earlier upload", () => {
    const issues = duplicateFile(
      buildRecord(),
      buildContext({ sameFile: [{ documentId: "d0", fileName: "march.pdf" }] }),
    );
    expect(issues).toEqual([
      expect.objectContaining({
        code: "duplicate_file",
        severity: "error",
        message: expect.stringContaining("march.pdf"),
      }),
    ]);
  });

  it("is quiet when no other document has the same hash", () => {
    expect(duplicateFile(buildRecord(), buildContext())).toEqual([]);
  });
});
