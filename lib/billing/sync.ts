import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import type { Database } from "@/lib/supabase/database.types";
import { planForPrice } from "./stripe";

/**
 * Applies a verified Stripe event to `subscriptions` (service-role client — webhooks only). Idempotent: each event
 * id is recorded once in `stripe_events`; events older than the last one applied to an org are ignored (Stripe
 * doesn't guarantee order). Returns the org it touched, if any.
 */

type Db = SupabaseClient<Database>;
type Update = Database["public"]["Tables"]["subscriptions"]["Update"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ts = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null);
const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

async function orgFor(db: Db, { orgId, customerId }: { orgId?: string | null; customerId?: string | null }) {
  if (orgId && UUID.test(orgId)) {
    const { data } = await db.from("organizations").select("id").eq("id", orgId).maybeSingle();
    if (data) return data.id;
  }
  if (customerId) {
    const { data } = await db
      .from("subscriptions")
      .select("org_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (data) return data.org_id;
  }
  return null;
}

async function write(db: Db, orgId: string, eventAt: string, values: Update) {
  const { data: current } = await db
    .from("subscriptions")
    .select("last_event_at")
    .eq("org_id", orgId)
    .maybeSingle();
  if (current?.last_event_at && Date.parse(current.last_event_at) > Date.parse(eventAt)) return false; // stale
  const { error } = await db
    .from("subscriptions")
    .upsert({ org_id: orgId, ...values, last_event_at: eventAt }, { onConflict: "org_id" });
  if (error) throw error;
  return true;
}

function subscriptionValues(sub: Stripe.Subscription, deleted: boolean): Update | null {
  const item = sub.items.data[0];
  if (!item) return null;
  const plan = planForPrice(item.price);
  if (!plan) return null;
  const periods = sub as unknown as { current_period_start?: number; current_period_end?: number };
  const itemPeriods = item as unknown as { current_period_start?: number; current_period_end?: number };
  return {
    stripe_customer_id: idOf(sub.customer),
    stripe_subscription_id: sub.id,
    plan,
    billing_interval: item.price.recurring?.interval === "year" ? "yearly" : "monthly",
    status: deleted ? "canceled" : sub.status,
    current_period_start: ts(periods.current_period_start ?? itemPeriods.current_period_start),
    current_period_end: ts(periods.current_period_end ?? itemPeriods.current_period_end),
    cancel_at_period_end: sub.cancel_at_period_end,
  };
}

export async function applyStripeEvent(
  db: Db,
  event: Stripe.Event,
): Promise<{ applied: boolean; orgId: string | null }> {
  const { error: seenError } = await db.from("stripe_events").insert({ id: event.id, type: event.type });
  if (seenError) {
    if (seenError.code === "23505") return { applied: false, orgId: null }; // already processed
    throw seenError;
  }
  const eventAt = new Date(event.created * 1000).toISOString();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription") return { applied: false, orgId: null };
      const orgId = await orgFor(db, {
        orgId: session.client_reference_id,
        customerId: idOf(session.customer),
      });
      if (!orgId) return { applied: false, orgId: null };
      // Plan + status arrive with customer.subscription.* — here only the ids, without moving last_event_at.
      const { error } = await db.from("subscriptions").upsert(
        {
          org_id: orgId,
          stripe_customer_id: idOf(session.customer),
          stripe_subscription_id: idOf(session.subscription),
        },
        { onConflict: "org_id" },
      );
      if (error) throw error;
      return { applied: true, orgId };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const orgId = await orgFor(db, { orgId: sub.metadata?.org_id, customerId: idOf(sub.customer) });
      const values = subscriptionValues(sub, event.type === "customer.subscription.deleted");
      if (!orgId || !values) return { applied: false, orgId };
      return { applied: await write(db, orgId, eventAt, values), orgId };
    }
    case "invoice.payment_failed":
    case "invoice.paid": {
      const invoice = event.data.object;
      const orgId = await orgFor(db, { customerId: idOf(invoice.customer) });
      if (!orgId) return { applied: false, orgId: null };
      const { error } = await db
        .from("subscriptions")
        .update({ payment_failed_at: event.type === "invoice.payment_failed" ? eventAt : null })
        .eq("org_id", orgId);
      if (error) throw error;
      return { applied: true, orgId };
    }
    default:
      return { applied: false, orgId: null };
  }
}
