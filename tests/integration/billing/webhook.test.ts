import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, cleanup, createOrg, createUser, type TestUser } from "../helpers";

process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_documax";
process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_monthly";
process.env.STRIPE_PRICE_BUSINESS_YEARLY = "price_business_yearly";
const { POST } = await import("@/app/api/stripe/webhook/route");

const admin = adminClient();
const signer = new Stripe("sk_test_unused").webhooks;
let owner: TestUser;
let orgId: string;
const customer = `cus_${randomUUID().slice(0, 8)}`;
const subscriptionId = `sub_${randomUUID().slice(0, 8)}`;

/** A Stripe event, as Stripe would send it, signed with the test secret. */
function post(event: Record<string, unknown>, secret = process.env.STRIPE_WEBHOOK_SECRET!) {
  const payload = JSON.stringify({
    object: "event",
    api_version: "2025-08-27.basil",
    livemode: false,
    ...event,
  });
  return POST(
    new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": signer.generateTestHeaderString({ payload, secret }) },
    }),
  );
}
const subscriptionEvent = (
  type: string,
  created: number,
  { price = "price_pro_monthly", interval = "month", status = "active", cancel = false } = {},
) => ({
  id: `evt_${randomUUID()}`,
  type,
  created,
  data: {
    object: {
      id: subscriptionId,
      object: "subscription",
      customer,
      status,
      cancel_at_period_end: cancel,
      metadata: { org_id: orgId },
      items: {
        data: [
          {
            price: { id: price, metadata: {}, recurring: { interval } },
            current_period_start: 1_793_491_200,
            current_period_end: 1_796_083_200,
          },
        ],
      },
    },
  },
});
const sub = async () =>
  (await admin.from("subscriptions").select("*").eq("org_id", orgId).maybeSingle()).data;
const plan = async () => (await admin.rpc("org_plan", { p_org: orgId })).data;

beforeAll(async () => {
  owner = await createUser("wh-owner");
  orgId = (await createOrg(owner, "Webhook Org", "property", { plan: "free" })).id;
});
afterAll(() => cleanup([orgId], [owner]));

describe("Stripe webhook", () => {
  it("rejects unsigned or wrongly signed requests", async () => {
    expect((await POST(new Request("http://x", { method: "POST", body: "{}" }))).status).toBe(400);
    expect(
      (await post({ id: "evt_bad", type: "invoice.paid", created: 1, data: { object: {} } }, "whsec_wrong"))
        .status,
    ).toBe(400);
  });

  it("checkout completion links the Stripe customer and subscription to the org", async () => {
    const res = await post({
      id: `evt_${randomUUID()}`,
      type: "checkout.session.completed",
      created: 1_793_491_100,
      data: {
        object: {
          object: "checkout.session",
          mode: "subscription",
          client_reference_id: orgId,
          customer,
          subscription: subscriptionId,
        },
      },
    });
    expect(res.status).toBe(200);
    expect(await sub()).toMatchObject({
      stripe_customer_id: customer,
      stripe_subscription_id: subscriptionId,
      plan: "free",
    });
  });

  it("subscription events set plan, interval, status and period; duplicates are ignored", async () => {
    const created = subscriptionEvent("customer.subscription.created", 1_793_491_200);
    expect((await post(created)).status).toBe(200);
    expect(await sub()).toMatchObject({
      plan: "pro",
      billing_interval: "monthly",
      status: "active",
      current_period_end: "2026-12-01T00:00:00+00:00",
    });
    expect(await plan()).toBe("pro");
    // Same event again (Stripe retries): processed once.
    await admin.from("subscriptions").update({ plan: "business" }).eq("org_id", orgId);
    expect((await post(created)).status).toBe(200);
    expect((await sub())?.plan).toBe("business");
    await admin.from("subscriptions").update({ plan: "pro" }).eq("org_id", orgId);
  });

  it("applies upgrades and ignores events older than the last one applied", async () => {
    await post(
      subscriptionEvent("customer.subscription.updated", 1_793_500_000, {
        price: "price_business_yearly",
        interval: "year",
      }),
    );
    expect(await sub()).toMatchObject({ plan: "business", billing_interval: "yearly" });
    await post(
      subscriptionEvent("customer.subscription.updated", 1_793_499_000, { price: "price_pro_monthly" }),
    );
    expect((await sub())?.plan).toBe("business");
  });

  it("payment failures are flagged; cancellation at period end keeps the plan until Stripe deletes it", async () => {
    await post({
      id: `evt_${randomUUID()}`,
      type: "invoice.payment_failed",
      created: 1_793_600_000,
      data: { object: { object: "invoice", customer } },
    });
    expect((await sub())?.payment_failed_at).not.toBeNull();
    await post({
      id: `evt_${randomUUID()}`,
      type: "invoice.paid",
      created: 1_793_600_100,
      data: { object: { object: "invoice", customer } },
    });
    expect((await sub())?.payment_failed_at).toBeNull();

    await post(
      subscriptionEvent("customer.subscription.updated", 1_793_700_000, {
        price: "price_business_yearly",
        interval: "year",
        cancel: true,
      }),
    );
    expect(await sub()).toMatchObject({ cancel_at_period_end: true, status: "active" });
    expect(await plan()).toBe("business");
    await post(
      subscriptionEvent("customer.subscription.deleted", 1_796_083_200, {
        price: "price_business_yearly",
        interval: "year",
        status: "canceled",
      }),
    );
    expect((await sub())?.status).toBe("canceled");
    expect(await plan()).toBe("free");
  });

  it("unknown prices and unrelated events change nothing", async () => {
    const before = await sub();
    await post(
      subscriptionEvent("customer.subscription.updated", 1_799_000_000, { price: "price_someone_else" }),
    );
    await post({
      id: `evt_${randomUUID()}`,
      type: "customer.created",
      created: 1_799_000_001,
      data: { object: {} },
    });
    expect(await sub()).toEqual(before);
  });
});
