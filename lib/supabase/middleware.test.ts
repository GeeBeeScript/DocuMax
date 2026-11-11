import { describe, expect, it } from "vitest";
import { safeNext } from "./middleware";

describe("safeNext", () => {
  it("keeps same-origin paths (with query)", () => {
    expect(safeNext("/invite/abc?x=1")).toBe("/invite/abc?x=1");
  });

  it.each([null, "", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])(
    "falls back for %s",
    (value) => {
      expect(safeNext(value)).toBe("/app");
    },
  );
});
