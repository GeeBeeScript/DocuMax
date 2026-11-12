import { describe, expect, it } from "vitest";
import { monthPeriod } from "@/lib/calc/period";
import {
  quoteFileName,
  safeFileName,
  statementFileName,
  summaryFileName,
  uniqueNames,
  batchZipName,
} from "./file-names";

describe("report file names", () => {
  it("names statements, summaries, quotes and ZIPs", () => {
    expect(statementFileName("12 Elm Street", monthPeriod("2026-10"))).toBe(
      "Statement - 12 Elm Street - 2026-10.pdf",
    );
    expect(summaryFileName({ start: "2026-10-01", end: "2026-11-15" })).toBe(
      "Summary - 2026-10-01 to 2026-11-15.pdf",
    );
    expect(quoteFileName("Q-2026-0001", "Deck build")).toBe("Quote Q-2026-0001 - Deck build.pdf");
    expect(batchZipName(monthPeriod("2026-10"))).toBe("Statements - 2026-10.zip");
  });

  it("removes unsafe characters", () => {
    expect(safeFileName('Unit 4/B: "Main" <rear>?')).toBe("Unit 4-B- -Main- -rear-");
    expect(safeFileName("..\\..\\etc")).toBe("etc");
    expect(safeFileName("   ")).toBe("Report");
    expect(safeFileName("a".repeat(300))).toHaveLength(150);
  });

  it("dedupes names within an archive, case-insensitively", () => {
    expect(uniqueNames(["A.pdf", "a.pdf", "A.pdf", "b.pdf"])).toEqual([
      "A.pdf",
      "a (2).pdf",
      "A (3).pdf",
      "b.pdf",
    ]);
  });
});
