import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { postRecord, type CalcAllocation, type CalcRecord } from "./postings";

const record = (over: Partial<CalcRecord> = {}): CalcRecord => ({
  id: "r1",
  documentType: "invoice",
  supplierName: "Brightline Plumbing",
  invoiceNumber: "INV-1",
  issueDate: "2026-10-14",
  currency: "USD",
  category: "repairs_maintenance",
  entityId: "A",
  taxCents: 9607,
  totalCents: 126057,
  lines: [],
  allocations: [],
  ...over,
});
const lines = [
  { id: "l1", position: 1, description: "Valve", category: "materials", amountCents: 42000 },
  { id: "l2", position: 2, description: "Labor", category: "labor_subcontract", amountCents: 56000 },
  { id: "l3", position: 3, description: "Fittings", category: "materials", amountCents: 18450 },
];
const totals = (ps: ReturnType<typeof postRecord>) => ({
  net: ps.reduce((a, p) => a + p.netCents, 0),
  tax: ps.reduce((a, p) => a + p.taxCents, 0),
  gross: ps.reduce((a, p) => a + p.grossCents, 0),
});
const byEntity = (ps: ReturnType<typeof postRecord>) => {
  const m: Record<string, number> = {};
  for (const p of ps) m[p.entityId ?? "none"] = (m[p.entityId ?? "none"] ?? 0) + p.grossCents;
  return m;
};

describe("postRecord", () => {
  it("an unallocated record without lines posts once to its entity", () => {
    expect(postRecord(record())).toEqual([
      expect.objectContaining({
        entityId: "A",
        lineId: null,
        netCents: 116450,
        taxCents: 9607,
        grossCents: 126057,
        split: false,
      }),
    ]);
    expect(postRecord(record({ entityId: null }))[0]!.entityId).toBeNull();
    expect(postRecord(record({ totalCents: null }))).toEqual([]);
  });

  it("lines become postings with their own categories; tax follows net", () => {
    const ps = postRecord(record({ lines }));
    expect(ps.map((p) => [p.lineId, p.category, p.netCents])).toEqual([
      ["l1", "materials", 42000],
      ["l2", "labor_subcontract", 56000],
      ["l3", "materials", 18450],
    ]);
    expect(totals(ps)).toEqual({ net: 116450, tax: 9607, gross: 126057 });
  });

  it("a difference between lines and subtotal becomes its own posting", () => {
    const ps = postRecord(record({ lines: lines.slice(0, 2) }));
    expect(ps.at(-1)).toMatchObject({ lineId: null, category: "repairs_maintenance", netCents: 18450 });
    expect(totals(ps).gross).toBe(126057);
  });

  it("record-level percent split: gross shares exact, tax follows", () => {
    const allocations: CalcAllocation[] = [
      { lineItemId: null, entityId: "A", method: "percent", percentBp: 6000, amountCents: null },
      { lineItemId: null, entityId: "B", method: "percent", percentBp: 4000, amountCents: null },
    ];
    const ps = postRecord(record({ lines, allocations }));
    expect(byEntity(ps)).toEqual({ A: 75634, B: 50423 }); // 60.00% / 40.00% of 1260.57, largest remainder
    expect(totals(ps)).toEqual({ net: 116450, tax: 9607, gross: 126057 });
    expect(ps.every((p) => p.split)).toBe(true);
  });

  it("record-level amount split: the named amount is exact, the rest stays with the record's entity", () => {
    const allocations: CalcAllocation[] = [
      { lineItemId: null, entityId: "B", method: "amount", percentBp: null, amountCents: 20000 },
    ];
    const ps = postRecord(record({ lines, allocations }));
    expect(byEntity(ps)).toEqual({ B: 20000, A: 106057 });
    expect(totals(ps).tax).toBe(9607);
  });

  it("line-level split: only that line moves", () => {
    const allocations: CalcAllocation[] = [
      { lineItemId: "l2", entityId: "B", method: "percent", percentBp: 5000, amountCents: null },
      { lineItemId: "l2", entityId: "C", method: "percent", percentBp: 5000, amountCents: null },
    ];
    const ps = postRecord(record({ lines, allocations }));
    const net = (e: string) => ps.filter((p) => p.entityId === e).reduce((a, p) => a + p.netCents, 0);
    expect([net("A"), net("B"), net("C")]).toEqual([60450, 28000, 28000]);
    expect(totals(ps)).toEqual({ net: 116450, tax: 9607, gross: 126057 });
  });

  it("credit notes printed positive post as negatives", () => {
    const ps = postRecord(record({ documentType: "credit_note", totalCents: 5000, taxCents: 0 }));
    expect(ps[0]).toMatchObject({ netCents: -5000, grossCents: -5000 });
    expect(
      postRecord(record({ documentType: "credit_note", totalCents: -5000, taxCents: 0 }))[0]!.grossCents,
    ).toBe(-5000);
  });

  it("property: every record reconciles to the cent whatever the split", () => {
    const entity = fc.constantFrom("A", "B", "C", "D");
    fc.assert(
      fc.property(
        fc.integer({ min: -2_000_000, max: 50_000_000 }),
        fc.integer({ min: 0, max: 30 }),
        fc.array(fc.integer({ min: -50_000, max: 500_000 }), { maxLength: 6 }),
        fc.option(fc.uniqueArray(entity, { minLength: 1, maxLength: 4 })),
        fc.constantFrom("percent", "amount", "line"),
        fc.option(entity),
        (total, taxPct, lineAmounts, splitEntities, mode, home) => {
          const taxCents = Math.round((total * taxPct) / 100) || 0;
          const ls = lineAmounts.map((a, i) => ({
            id: `l${i}`,
            position: i + 1,
            description: null,
            category: null,
            amountCents: a,
          }));
          let allocations: CalcAllocation[] = [];
          if (splitEntities) {
            if (mode === "percent") {
              const bp = Math.floor(10000 / splitEntities.length);
              allocations = splitEntities.map((e, i) => ({
                lineItemId: null,
                entityId: e,
                method: "percent",
                percentBp: i === 0 ? 10000 - bp * (splitEntities.length - 1) : bp,
                amountCents: null,
              }));
            } else if (mode === "amount") {
              const each = Math.trunc(total / (splitEntities.length + 1));
              allocations = splitEntities.map((e) => ({
                lineItemId: null,
                entityId: e,
                method: "amount",
                percentBp: null,
                amountCents: each,
              }));
            } else if (ls.length) {
              allocations = splitEntities.map((e, i) => ({
                lineItemId: "l0",
                entityId: e,
                method: "percent",
                percentBp:
                  i === 0
                    ? 10000 - Math.floor(10000 / splitEntities.length) * (splitEntities.length - 1)
                    : Math.floor(10000 / splitEntities.length),
                amountCents: null,
              }));
            }
          }
          const ps = postRecord(
            record({ totalCents: total, taxCents, lines: ls, allocations, entityId: home }),
          );
          const t = totals(ps);
          expect(t.gross).toBe(total);
          expect(t.tax).toBe(taxCents);
          expect(t.net).toBe(total - taxCents);
          ps.forEach((p) => expect(p.grossCents).toBe(p.netCents + p.taxCents));
        },
      ),
      { numRuns: 300 },
    );
  });
});
