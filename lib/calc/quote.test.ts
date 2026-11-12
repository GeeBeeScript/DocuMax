import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { entities, records } from "./__fixtures__/statement-records";
import { monthPeriod } from "./period";
import { buildQuote } from "./quote";

const base = {
  org: { name: "Summit Trades" },
  entity: entities[0]!,
  period: monthPeriod("2026-10"),
  currency: "USD",
  records,
  number: "Q-2026-001",
  issueDate: "2026-11-01",
  validUntil: "2026-12-01",
  generatedAt: "",
};

describe("buildQuote", () => {
  it("marks up each cost line and taxes the subtotal; lines always add up", () => {
    const q = buildQuote({ ...base, markupBp: 1500, taxRateBp: 825 });
    expect(q.lines.map((l) => l.description)).toContain("Labor 3.5 hours");
    expect(q.costTotal).toBe(116450 + 27000 - 5000); // net costs: plumbing lines + 60% landscaping − credit
    expect(q.markupTotal).toBe(q.lines.reduce((a, l) => a + l.markup, 0));
    expect(q.subtotal).toBe(q.costTotal + q.markupTotal);
    expect(q.tax).toBe(Math.round((q.subtotal * 825) / 10000));
    expect(q.total).toBe(q.subtotal + q.tax);
    const labor = q.lines.find((l) => l.description === "Labor 3.5 hours")!;
    expect(labor).toMatchObject({ cost: 56000, markup: 8400, price: 64400 });
  });

  it("rejects out-of-range rates", () => {
    expect(() => buildQuote({ ...base, markupBp: -1, taxRateBp: 0 })).toThrow(/Markup/);
    expect(() => buildQuote({ ...base, markupBp: 0, taxRateBp: 10001 })).toThrow(/Tax rate/);
  });

  it("property: totals reconcile for any rates", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 10000 }),
        (markupBp, taxRateBp) => {
          const q = buildQuote({ ...base, markupBp, taxRateBp });
          expect(q.lines.reduce((a, l) => a + l.price, 0)).toBe(q.subtotal);
          expect(q.costTotal + q.markupTotal).toBe(q.subtotal);
          expect(q.subtotal + q.tax).toBe(q.total);
        },
      ),
    );
  });
});
