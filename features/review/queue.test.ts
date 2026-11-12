import { describe, expect, it } from "vitest";
import { countIssues, filterQueue, sortQueue, type QueueItem } from "./queue";

const item = (id: string, over: Partial<QueueItem> = {}): QueueItem => ({
  id,
  documentId: null,
  fileName: `${id}.pdf`,
  supplierName: "ACME Plumbing LLC",
  invoiceNumber: null,
  issueDate: null,
  totalCents: 100,
  currency: "USD",
  entityId: null,
  entityName: null,
  minConfidence: 0.95,
  issues: [],
  createdAt: `2026-11-0${id.length}T00:00:00Z`,
  ...over,
});
const error = { code: "total_mismatch" as const, severity: "error" as const };
const warning = { code: "no_entity" as const, severity: "warning" as const };

describe("review queue", () => {
  it("orders errors, then warnings, then clean; oldest first within", () => {
    const items = [
      item("c", { createdAt: "2026-11-01T00:00:00Z" }),
      item("w2", { issues: [warning], createdAt: "2026-11-03T00:00:00Z" }),
      item("w1", { issues: [warning], createdAt: "2026-11-02T00:00:00Z" }),
      item("e", { issues: [warning, error], createdAt: "2026-11-09T00:00:00Z" }),
    ];
    expect(sortQueue(items).map((i) => i.id)).toEqual(["e", "w1", "w2", "c"]);
  });

  it("counts records per code (once per record) and clean ones", () => {
    const items = [
      item("a", { issues: [warning, warning] }),
      item("b", { issues: [error, warning] }),
      item("c"),
    ];
    expect(countIssues(items)).toEqual({ no_entity: 2, total_mismatch: 1, clean: 1 });
  });

  it("filters by issue, clean, entity, supplier (normalized) and confidence", () => {
    const items = [
      item("a", { issues: [error], entityId: "E1", minConfidence: 0.5 }),
      item("b", { supplierName: "Brightline Plumbing Co." }),
    ];
    const ids = (f: Parameters<typeof filterQueue>[1]) => filterQueue(items, f, 0.85).map((i) => i.id);
    expect(ids({ issue: "total_mismatch" })).toEqual(["a"]);
    expect(ids({ issue: "clean" })).toEqual(["b"]);
    expect(ids({ entity: "E1" })).toEqual(["a"]);
    expect(ids({ supplier: "acme plumbing" })).toEqual(["a"]);
    expect(ids({ supplier: "BRIGHTLINE" })).toEqual(["b"]);
    expect(ids({ confidence: "low" })).toEqual(["a"]);
    expect(ids({ confidence: "ok" })).toEqual(["b"]);
  });
});
