import Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import type { BillingInterval, PlanId } from "./plans";

/**
 * Stripe access (server only). The secret key and price ids come from env; without a key, billing actions say
 * "billing isn't set up" instead of failing. Webhook signatures are verified without an API call.
 */

export class BillingNotConfigured extends Error {
  constructor() {
    super("Billing isn't set up yet.");
    this.name = "BillingNotConfigured";
  }
}

let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = serverEnv().STRIPE_SECRET_KEY;
  if (!key) throw new BillingNotConfigured();
  client ??= new Stripe(key, { appInfo: { name: "DocuMax" } });
  return client;
}

/** Signature verification only needs the webhook secret; a placeholder key is fine for this. */
export const webhooks = () => new Stripe(serverEnv().STRIPE_SECRET_KEY || "sk_unset").webhooks;

export type PaidPlan = Extract<PlanId, "pro" | "business">;
export const PAID_PLANS: readonly PaidPlan[] = ["pro", "business"];

function priceTable(): Record<PaidPlan, Record<BillingInterval, string | undefined>> {
  const env = serverEnv();
  return {
    pro: { monthly: env.STRIPE_PRICE_PRO_MONTHLY, yearly: env.STRIPE_PRICE_PRO_YEARLY },
    business: { monthly: env.STRIPE_PRICE_BUSINESS_MONTHLY, yearly: env.STRIPE_PRICE_BUSINESS_YEARLY },
  };
}

export const priceIdFor = (plan: PaidPlan, interval: BillingInterval) => priceTable()[plan][interval] ?? null;

/**
 * Which plan a Stripe price stands for: our env mapping first, then the price's `metadata.plan` (prices carry it
 * so the dashboard and the code agree — docs/DATA_MODEL.md).
 */
export function planForPrice(price: {
  id: string;
  metadata?: Record<string, string> | null;
}): PaidPlan | null {
  for (const plan of PAID_PLANS) {
    const prices = priceTable()[plan];
    if (prices.monthly === price.id || prices.yearly === price.id) return plan;
  }
  const meta = price.metadata?.plan;
  return meta && (PAID_PLANS as readonly string[]).includes(meta) ? (meta as PaidPlan) : null;
}
