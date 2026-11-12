"use server";

import { billingCopy } from "@/content/app";
import { fail, failCode, invalid, ok, type ActionResult } from "@/lib/actions/result";
import { ForbiddenError, hasRole } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { BillingNotConfigured, priceIdFor, stripe } from "@/lib/billing/stripe";
import { clientEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CheckoutSchema } from "./schema";

/*
 * Billing Server Actions (owners only — PRD). Both return a Stripe-hosted URL the browser goes to; the plan itself
 * changes only when the signed webhook arrives (lib/billing/sync.ts), never from these actions.
 */

const BILLING_PATH = "/app/settings/billing";
const ACTIVE = new Set(["active", "trialing", "past_due"]);

function billingError(error: unknown) {
  if (error instanceof BillingNotConfigured)
    return failCode("billing_not_configured", billingCopy.notConfigured);
  console.error("stripe call failed", { message: (error as Error).message });
  return fail("Couldn't reach the payment provider. Please try again.");
}

async function ownerContext() {
  const ctx = await requireActiveOrg();
  return hasRole(ctx.role, ["owner"]) ? ctx : null;
}

/** Stripe Checkout for a paid plan, or the Customer Portal when the org already pays (plan changes happen there). */
export async function startCheckout(input: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = CheckoutSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await ownerContext();
  if (!ctx) return fail(new ForbiddenError().message);
  const price = priceIdFor(parsed.data.plan, parsed.data.interval);
  if (!price) return fail(billingCopy.notAvailable);

  const supabase = await createSupabaseServerClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id, status, stripe_subscription_id")
    .eq("org_id", ctx.org.id)
    .maybeSingle();
  const appUrl = clientEnv().NEXT_PUBLIC_APP_URL;
  try {
    const api = stripe();
    let customer = sub?.stripe_customer_id ?? null;
    if (customer && sub?.stripe_subscription_id && ACTIVE.has(sub.status)) {
      const portal = await api.billingPortal.sessions.create({
        customer,
        return_url: `${appUrl}${BILLING_PATH}`,
      });
      return ok({ url: portal.url });
    }
    if (!customer) {
      const created = await api.customers.create({
        name: ctx.org.name,
        email: ctx.email,
        metadata: { org_id: ctx.org.id },
      });
      customer = created.id;
      const { error } = await supabase.rpc("set_stripe_customer", {
        p_org: ctx.org.id,
        p_customer: customer,
      });
      if (error) return fail("Something went wrong. Please try again.");
    }
    const session = await api.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: ctx.org.id,
      line_items: [{ price, quantity: 1 }],
      subscription_data: { metadata: { org_id: ctx.org.id } },
      allow_promotion_codes: true,
      success_url: `${appUrl}${BILLING_PATH}?checkout=success`,
      cancel_url: `${appUrl}${BILLING_PATH}`,
    });
    if (!session.url) return fail("Couldn't reach the payment provider. Please try again.");
    return ok({ url: session.url });
  } catch (error) {
    return billingError(error);
  }
}

/** Stripe Customer Portal: card, invoices, plan changes and cancellation (downgrades apply at period end). */
export async function openBillingPortal(): Promise<ActionResult<{ url: string }>> {
  const ctx = await ownerContext();
  if (!ctx) return fail(new ForbiddenError().message);
  const supabase = await createSupabaseServerClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("org_id", ctx.org.id)
    .maybeSingle();
  if (!sub?.stripe_customer_id) return fail("There's no billing account yet — choose a plan first.");
  try {
    const portal = await stripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${clientEnv().NEXT_PUBLIC_APP_URL}${BILLING_PATH}`,
    });
    return ok({ url: portal.url });
  } catch (error) {
    return billingError(error);
  }
}
