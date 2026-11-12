import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { entities, records } from "./__fixtures__/statement-records";
import { monthPeriod } from "./period";
import { buildPortfolio, buildStatement, type StatementRecord } from "./statement";

const october = monthPeriod("2026-10");
const org = { name: "Harbor & Pine Property Management" };

describe("buildStatement", () => {
  const statement = buildStatement({
    org,
    entity: entities[0]!,
    period: october,
    currency: "USD",
    records,
    generatedAt: "2026-11-01T09:00:00.000Z",
  });

  it("matches the golden file", async () => {
    await expect(JSON.stringify(statement, null, 2) + "\n").toMatchFileSnapshot(
      "./__golden__/statement-elm-2026-10.json",
    );
  });

  it("only approved, in-period, same-currency records; totals equal the sum of lines and of categories", () => {
    const ids = new Set(statement.lines.map((l) => l.recordId));
    expect([...ids].sort()).toEqual(["r-credit", "r-landscaping", "r-plumbing"]);
    const sum = (xs: { gross: number }[]) => xs.reduce((a, x) => a + x.gross, 0);
    expect(sum(statement.lines)).toBe(statement.summary.gross);
    expect(sum(statement.categories)).toBe(statement.summary.gross);
    expect(statement.lines.reduce((a, l) => a + l.tax, 0)).toBe(statement.summary.tax);
    expect(statement.categories.reduce((a, c) => a + c.shareBp, 0)).toBe(10000);
    expect(statement.summary.gross).toBe(126057 + 27000 - 5000);
    expect(statement.otherCurrencies).toEqual([{ currency: "EUR", records: 1, gross: 1500 }]);
    expect(statement.period.label).toBe("October 2026");
  });
});

describe("buildPortfolio", () => {
  it("portfolio total equals the sum of entity totals (incl. unassigned)", () => {
    const p = buildPortfolio({ org, entities, period: october, currency: "USD", records });
    expect(p.rows.map((r) => [r.entity?.id ?? null, r.totals.gross])).toEqual([
      ["elm", 148057],
      ["oak", 26913],
      [null, 2599],
    ]);
    expect(p.total.gross).toBe(148057 + 26913 + 2599);
    expect(p.total.records).toBe(5); // the split record counts once
  });

  it("property: for random approved records and splits, Σ entity rows = total = Σ record totals", () => {
    const ids = ["elm", "oak", "pine"];
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            total: fc.integer({ min: -100_000, max: 10_000_000 }),
            taxPct: fc.integer({ min: 0, max: 25 }),
            entity: fc.option(fc.constantFrom(...ids)),
            split: fc.option(fc.integer({ min: 1, max: 9999 })),
            day: fc.integer({ min: 1, max: 31 }),
          }),
          { maxLength: 25 },
        ),
        (rows) => {
          const recs: StatementRecord[] = rows.map((r, i) => ({
            id: `r${i}`,
            status: "approved",
            documentType: "invoice",
            supplierName: `S${i % 3}`,
            invoiceNumber: null,
            issueDate: `2026-10-${String(r.day).padStart(2, "0")}`,
            currency: "USD",
            category: null,
            entityId: r.entity,
            taxCents: Math.round((r.total * r.taxPct) / 100) || 0,
            totalCents: r.total,
            lines: [],
            allocations: r.split
              ? [
                  {
                    lineItemId: null,
                    entityId: "elm",
                    method: "percent",
                    percentBp: r.split,
                    amountCents: null,
                  },
                  {
                    lineItemId: null,
                    entityId: "oak",
                    method: "percent",
                    percentBp: 10000 - r.split,
                    amountCents: null,
                  },
                ]
              : [],
          }));
          const ents = ids.map((id) => ({ id, name: id, code: null, address: null, clientName: null }));
          const p = buildPortfolio({ org, entities: ents, period: october, currency: "USD", records: recs });
          expect(p.rows.reduce((a, r) => a + r.totals.gross, 0)).toBe(p.total.gross);
          expect(p.total.gross).toBe(rows.reduce((a, r) => a + r.total, 0));
          // Each entity's statement equals its portfolio row; statements + unassigned = portfolio total.
          const statementGross = ents.map(
            (entity) =>
              buildStatement({
                org,
                entity,
                period: october,
                currency: "USD",
                records: recs,
                generatedAt: "",
              }).summary.gross,
          );
          ents.forEach((e, i) =>
            expect(statementGross[i]).toBe(p.rows.find((r) => r.entity?.id === e.id)?.totals.gross ?? 0),
          );
          const unassigned = p.rows.find((r) => r.entity === null)?.totals.gross ?? 0;
          expect(statementGross.reduce((a, b) => a + b, 0) + unassigned).toBe(p.total.gross);
        },
      ),
      { numRuns: 200 },
    );
  });
});
