import { describe, expect, it } from "vitest";
import { fieldLabel, formatValue } from "./format";

describe("history formatting", () => {
  it("labels fields with entity wording", () => {
    expect(fieldLabel("total_cents", "Job")).toBe("Total");
    expect(fieldLabel("entity_id", "Job")).toBe("Job");
    expect(fieldLabel("some_column", "Job")).toBe("some column");
  });

  it("formats money, enums, entities, line counts and empties", () => {
    expect(formatValue("total_cents", 126057, { currency: "EUR" })).toBe("€1,260.57");
    expect(formatValue("category", "labor_subcontract")).toBe("Labor & subcontractors");
    expect(formatValue("entity_id", "abc", { names: new Map([["abc", "Elm St"]]) })).toBe("Elm St");
    expect(formatValue("line_items", [{}, {}])).toBe("2 lines");
    expect(formatValue("currency", null)).toBe("(empty)");
  });
});
