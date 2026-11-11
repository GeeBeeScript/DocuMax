/**
 * Plan catalogue — single source of truth for document caps, seats and list prices.
 * Used by the pricing page now and by quota enforcement + Stripe in Phase 10.
 * Prices are per organization per month, in cents. PLACEHOLDER prices — confirm before launch.
 */
import { cents, type Cents } from "@/lib/calc/money";

export const PLAN_IDS = ["free", "pro", "business", "enterprise"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type BillingInterval = "monthly" | "yearly";

export interface Plan {
  id: PlanId;
  name: string;
  /** Documents processed per calendar month. `null` = custom/unlimited (enterprise). */
  documentsPerMonth: number | null;
  /** Included seats. `null` = custom. */
  seats: number | null;
  /** Monthly-equivalent price per interval. `null` = contact sales. */
  price: Record<BillingInterval, Cents> | null;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    documentsPerMonth: 25,
    seats: 1,
    price: { monthly: cents(0), yearly: cents(0) },
  },
  pro: {
    id: "pro",
    name: "Pro",
    documentsPerMonth: 500,
    seats: 5,
    price: { monthly: cents(4900), yearly: cents(3900) },
  },
  business: {
    id: "business",
    name: "Business",
    documentsPerMonth: 2500,
    seats: 20,
    price: { monthly: cents(14900), yearly: cents(11900) },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    documentsPerMonth: null,
    seats: null,
    price: null,
  },
};

/** Yearly discount as a whole percentage, derived from the Pro plan prices. */
export function yearlyDiscountPercent(plan: Plan = PLANS.pro): number {
  if (!plan.price || plan.price.monthly === 0) return 0;
  return Math.round((1 - plan.price.yearly / plan.price.monthly) * 100);
}
