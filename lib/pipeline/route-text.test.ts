import { describe, expect, it } from "vitest";
import { cleanText, isSparse, pagesNeedingOcr, visibleChars } from "./route-text";

describe("sparse-page routing", () => {
  it("counts only visible characters", () => {
    expect(visibleChars("  a b\n\tc  ")).toBe(3);
  });

  it("a page is sparse below 40 visible characters (whitespace doesn't count)", () => {
    expect(isSparse("x".repeat(39))).toBe(true);
    expect(isSparse("x".repeat(40))).toBe(false);
    expect(isSparse(`${"x ".repeat(39)}\n\n\n`)).toBe(true);
  });

  it("digital PDFs need no OCR", () => {
    expect(
      pagesNeedingOcr(["Invoice INV-1 Brightline Plumbing Co. Total due 1260.57", "x".repeat(400)]),
    ).toEqual([]);
  });

  it("scanned PDFs OCR every page", () => {
    expect(pagesNeedingOcr(["", " ", "\n"])).toEqual([1, 2, 3]);
  });

  it("mixed PDFs OCR only their sparse pages, even when most pages have text", () => {
    expect(pagesNeedingOcr(["x".repeat(300), "", "x".repeat(300), "x".repeat(300)])).toEqual([2]);
  });

  it("respects a custom threshold", () => {
    expect(pagesNeedingOcr(["short", "longer text"], 8)).toEqual([1]);
  });
});

describe("cleanText", () => {
  it("normalizes newlines, trailing spaces and blank runs", () => {
    expect(cleanText("  a  \r\nb\t\r\n\n\n\n c \n")).toBe("a\nb\n\n c");
  });
});
