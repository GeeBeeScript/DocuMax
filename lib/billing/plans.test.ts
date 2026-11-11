import { describe, expect, it } from "vitest";
import { PLANS, PLAN_IDS, yearlyDiscountPercent } from "./plans";

describe("plans", () => {
  it("defines every plan id", () => {
    expect(Object.keys(PLANS).sort()).toEqual([...PLAN_IDS].sort());
  });

  it("caps increase with plan tier", () => {
    expect(PLANS.free.documentsPerMonth!).toBeLessThan(PLANS.pro.documentsPerMonth!);
    expect(PLANS.pro.documentsPerMonth!).toBeLessThan(PLANS.business.documentsPerMonth!);
  });

  it("yearly is never more expensive than monthly", () => {
    for (const plan of Object.values(PLANS)) {
      if (plan.price) expect(plan.price.yearly).toBeLessThanOrEqual(plan.price.monthly);
    }
  });

  it("computes the yearly discount", () => {
    expect(yearlyDiscountPercent()).toBe(20);
  });
});
