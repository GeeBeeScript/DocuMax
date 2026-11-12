import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { AllocationError, allocateByAmount, allocateByPercent, allocateByWeights } from "./allocate";
import { cents } from "./money";

const sum = (shares: { cents: number }[]) => shares.reduce((a, s) => a + s.cents, 0);
const amounts = (shares: { cents: number }[]) => shares.map((s) => s.cents);

describe("allocateByPercent", () => {
  it("splits evenly with the leftover cent going to the largest remainder", () => {
    expect(
      amounts(
        allocateByPercent(cents(10000), [
          { key: "a", percentBp: 3334 },
          { key: "b", percentBp: 3333 },
          { key: "c", percentBp: 3333 },
        ]),
      ),
    ).toEqual([3334, 3333, 3333]);
    // 100.00 / 3 — 3333.33… each: one extra cent to the first (ties → earlier)
    expect(
      amounts(
        allocateByPercent(cents(10000), [
          { key: "a", percentBp: 3333 },
          { key: "b", percentBp: 3334 },
          { key: "c", percentBp: 3333 },
        ]),
      ),
    ).toEqual([3333, 3334, 3333]);
    expect(
      amounts(
        allocateByPercent(cents(1), [
          { key: "a", percentBp: 5000 },
          { key: "b", percentBp: 5000 },
        ]),
      ),
    ).toEqual([1, 0]);
  });

  it("handles negatives (credit notes), zero and large values", () => {
    expect(
      amounts(
        allocateByPercent(cents(-1001), [
          { key: "a", percentBp: 5000 },
          { key: "b", percentBp: 5000 },
        ]),
      ),
    ).toEqual([-500, -501]);
    expect(amounts(allocateByPercent(cents(0), [{ key: "a", percentBp: 10000 }]))).toEqual([0]);
    const big = 9_000_000_000_000_00; // $9 trillion in cents, still a safe integer
    const shares = allocateByPercent(cents(big), [
      { key: "a", percentBp: 1 },
      { key: "b", percentBp: 9999 },
    ]);
    expect(sum(shares)).toBe(big);
    expect(shares[0]!.cents).toBe(big / 10000);
  });

  it("rejects percentages that don't total 100% or are out of range", () => {
    expect(() =>
      allocateByPercent(cents(100), [
        { key: "a", percentBp: 6000 },
        { key: "b", percentBp: 3000 },
      ]),
    ).toThrow("Percentages must add up to 100%.");
    expect(() =>
      allocateByPercent(cents(100), [
        { key: "a", percentBp: 10001 },
        { key: "b", percentBp: -1 },
      ]),
    ).toThrow(AllocationError);
    expect(() => allocateByPercent(cents(100), [{ key: "a", percentBp: 50.5 }])).toThrow(/between/);
    expect(() => allocateByPercent(cents(100), [])).toThrow(/Nothing/);
    expect(() =>
      allocateByPercent(cents(100), [
        { key: "a", percentBp: 5000 },
        { key: "a", percentBp: 5000 },
      ]),
    ).toThrow(/once/);
  });

  it("property: shares always sum to the total and each is within a cent of its exact share", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10_000_000_000, max: 10_000_000_000 }),
        fc
          .array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 12 })
          .filter((w) => w.some((x) => x > 0)),
        (total, raw) => {
          // Turn raw weights into basis points that total exactly 10 000.
          const bp = amounts(
            allocateByWeights(
              cents(10000),
              raw.map((w, i) => ({ key: `k${i}`, weight: w })),
            ),
          );
          const shares = allocateByPercent(
            cents(total),
            bp.map((p, i) => ({ key: `k${i}`, percentBp: p })),
          );
          expect(sum(shares)).toBe(total);
          shares.forEach((s, i) => expect(Math.abs(s.cents - (total * bp[i]!) / 10000)).toBeLessThan(1));
        },
      ),
    );
  });
});

describe("allocateByAmount", () => {
  it("fixed amounts with the remainder to the record's entity", () => {
    expect(allocateByAmount(cents(126057), [{ key: "unitB", amountCents: cents(20000) }], "unitA")).toEqual([
      { key: "unitB", cents: 20000 },
      { key: "unitA", cents: 106057 },
    ]);
    expect(
      allocateByAmount(
        cents(1000),
        [
          { key: "a", amountCents: cents(400) },
          { key: "b", amountCents: cents(100) },
        ],
        "b",
      ),
    ).toEqual([
      { key: "a", cents: 400 },
      { key: "b", cents: 600 },
    ]);
    expect(allocateByAmount(cents(1000), [{ key: "a", amountCents: cents(1000) }], "z")).toEqual([
      { key: "a", cents: 1000 },
    ]);
  });

  it("credits split into negative amounts; mismatched signs and overshoot are refused", () => {
    expect(amounts(allocateByAmount(cents(-500), [{ key: "a", amountCents: cents(-200) }], "b"))).toEqual([
      -200, -300,
    ]);
    expect(() => allocateByAmount(cents(-500), [{ key: "a", amountCents: cents(200) }], "b")).toThrow(
      /negative/,
    );
    expect(() => allocateByAmount(cents(500), [{ key: "a", amountCents: cents(-1) }], "b")).toThrow(
      /positive/,
    );
    expect(() =>
      allocateByAmount(
        cents(500),
        [
          { key: "a", amountCents: cents(300) },
          { key: "b", amountCents: cents(201) },
        ],
        "c",
      ),
    ).toThrow("The amounts add up to more than the total.");
  });

  it("property: always reconciles to the cent", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 8 }),
        (total, parts) => {
          const scale = Math.max(
            1,
            parts.reduce((a, b) => a + b, 0),
          );
          const shares = parts.map((p, i) => ({
            key: `k${i}`,
            amountCents: cents(Math.floor((total * p) / scale)),
          }));
          expect(sum(allocateByAmount(cents(total), shares, "rest"))).toBe(total);
        },
      ),
    );
  });
});

describe("allocateByWeights", () => {
  it("weights of mixed sign (e.g. a discount line) still reconcile; zero weights give all to the first", () => {
    const shares = allocateByWeights(cents(1000), [
      { key: "a", weight: 3 },
      { key: "b", weight: -1 },
      { key: "c", weight: 1 },
    ]);
    expect(sum(shares)).toBe(1000);
    expect(amounts(shares)).toEqual([1000, -333, 333]);
    expect(
      amounts(
        allocateByWeights(cents(7), [
          { key: "a", weight: 0 },
          { key: "b", weight: 0 },
        ]),
      ),
    ).toEqual([7, 0]);
  });

  it("property: any weights with a non-zero sum reconcile", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }),
        fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 1, maxLength: 10 }),
        (total, ws) => {
          const shares = allocateByWeights(
            cents(total),
            ws.map((w, i) => ({ key: `k${i}`, weight: w })),
          );
          expect(sum(shares)).toBe(total);
        },
      ),
    );
  });
});

describe("percent strings", () => {
  it("parses exactly and formats back", async () => {
    const { parsePercentBp, formatBp } = await import("./allocate");
    expect(["60", "33.33", "12,5 %", "0.01", "100", "100.00"].map(parsePercentBp)).toEqual([
      6000, 3333, 1250, 1, 10000, 10000,
    ]);
    expect(["100.01", "1.234", "-5", "abc", ""].map(parsePercentBp)).toEqual([null, null, null, null, null]);
    expect([6000, 3333, 1250, 1, 0].map(formatBp)).toEqual(["60", "33.33", "12.5", "0.01", "0"]);
  });
});
