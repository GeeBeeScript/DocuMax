import { describe, expect, it } from "vitest";
import { routeRecord, sortIssues, validateRecord } from "./index";
import { buildContext, buildRecord } from "./test-builders";

const cleanLines = [{ position: 1, quantity: "2", unitPriceCents: 58225, amountCents: 116450 }];

describe("validateRecord + routeRecord", () => {
  it("a clean record has no issues → document ready, record awaits approval", () => {
    const issues = validateRecord(buildRecord({ lines: cleanLines }), buildContext());
    expect(issues).toEqual([]);
    expect(routeRecord(issues, { autoApprove: false })).toEqual({
      documentStatus: "ready",
      recordStatus: "needs_review",
    });
    expect(routeRecord(issues, { autoApprove: true })).toEqual({
      documentStatus: "ready",
      recordStatus: "approved",
    });
  });

  it("any issue (even a warning) routes to review, regardless of auto-approve", () => {
    const issues = validateRecord(buildRecord({ lines: cleanLines, entityId: null }), buildContext());
    expect(issues.map((i) => i.code)).toEqual(["no_entity"]);
    expect(routeRecord(issues, { autoApprove: true })).toEqual({
      documentStatus: "needs_review",
      recordStatus: "needs_review",
    });
  });

  it("collects issues from every rule, errors first", () => {
    const issues = validateRecord(
      buildRecord({ currency: null, totalCents: 1, entityId: null }),
      buildContext({ sameFile: [{ documentId: "d", fileName: "x.pdf" }] }),
    );
    expect(issues.map((i) => i.code)).toEqual([
      "duplicate_file",
      "missing_field",
      "total_mismatch",
      "line_math",
      "no_entity",
    ]);
    expect(sortIssues([{ severity: "warning" }, { severity: "error" }])).toEqual([
      { severity: "error" },
      { severity: "warning" },
    ]);
  });

  it("correcting a value clears its issue immediately", () => {
    const flagged = buildRecord({ lines: cleanLines, totalCents: 126099 });
    expect(validateRecord(flagged, buildContext()).map((i) => i.code)).toEqual(["total_mismatch"]);
    expect(validateRecord({ ...flagged, totalCents: 126057 }, buildContext())).toEqual([]);
  });
});
