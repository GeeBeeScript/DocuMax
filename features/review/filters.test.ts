import { describe, expect, it } from "vitest";
import { parseQueueFilters, queueQueryString } from "./filters";

describe("queue filters", () => {
  it("keeps valid values and drops invalid ones", () => {
    expect(
      parseQueueFilters({
        issue: "total_mismatch",
        entity: "not-a-uuid",
        supplier: "  Acme ",
        confidence: ["low", "ok"],
      }),
    ).toEqual({ issue: "total_mismatch", supplier: "Acme", confidence: "low" });
    expect(parseQueueFilters({ issue: "nope", supplier: "" })).toEqual({});
  });

  it("serializes to a query string", () => {
    expect(queueQueryString({})).toBe("");
    expect(queueQueryString({ issue: "clean", supplier: "A & B" })).toBe("?issue=clean&supplier=A+%26+B");
  });
});
