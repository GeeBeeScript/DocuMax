import { describe, expect, it } from "vitest";
import { auditChanges, auditCurrency } from "./diff";

describe("auditChanges", () => {
  it("updates: changed keys with before/after, bookkeeping hidden", () => {
    expect(
      auditChanges({
        action: "update",
        before: { total_cents: 126099, status: "needs_review", field_confidence: {} },
        after: { total_cents: 126057, status: "approved", currency: "USD" },
        diff: { total_cents: 126057, status: "approved", field_confidence: { total_cents: 1 } },
      }),
    ).toEqual([
      { key: "status", before: "needs_review", after: "approved" },
      { key: "total_cents", before: 126099, after: 126057 },
    ]);
  });

  it("inserts and deletes: identifying columns only", () => {
    expect(
      auditChanges({
        action: "insert",
        before: null,
        diff: null,
        after: { id: "x", name: "Elm", code: null },
      }),
    ).toEqual([{ key: "name", before: null, after: "Elm" }]);
    expect(
      auditChanges({ action: "delete", after: null, diff: null, before: { email: "a@b.c", role: "member" } }),
    ).toEqual([
      { key: "email", before: "a@b.c", after: null },
      { key: "role", before: "member", after: null },
    ]);
  });

  it("finds the currency on either side", () => {
    expect(auditCurrency({ before: { currency: "EUR" }, after: null })).toBe("EUR");
    expect(auditCurrency({ before: null, after: {} })).toBeNull();
  });
});
