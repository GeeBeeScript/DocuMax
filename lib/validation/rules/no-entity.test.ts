import { describe, expect, it } from "vitest";
import { buildRecord } from "../test-builders";
import { noEntity } from "./no-entity";

describe("no_entity", () => {
  it("assigned → no issue; unassigned → warning", () => {
    expect(noEntity(buildRecord())).toEqual([]);
    expect(noEntity(buildRecord({ entityId: null }))).toEqual([
      expect.objectContaining({ code: "no_entity", severity: "warning", field: "entity" }),
    ]);
  });
});
