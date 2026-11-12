import { describe, expect, it } from "vitest";
import { safeNext } from "./middleware";

describe("safeNext", () => {
  it("keeps same-origin paths (with query)", () => {
    expect(safeNext("/invite/abc?x=1")).toBe("/invite/abc?x=1");
    expect(safeNext("/app/documents#top")).toBe("/app/documents#top");
  });

  it("returns the normalised path, never a different origin", () => {
    expect(safeNext("/app/../login")).toBe("/login");
    expect(safeNext("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });

  it.each([
    null,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/%09/evil.example".replace("%09", "\t"),
    "/app\\..\\\\evil.example",
    "javascript:alert(1)",
  ])("falls back for %s", (value) => {
    expect(safeNext(value)).toBe("/app");
  });
});
