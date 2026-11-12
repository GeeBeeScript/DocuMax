import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addMember, adminClient, cleanup, createOrg, createUser, setPlan, type TestUser } from "../helpers";
import { actAs } from "../next-mocks";

/** Stripe is mocked: these tests cover who may do what and what we store, not Stripe itself. */
const fake = vi.hoisted(() => ({
  configured: true,
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
}));
vi.mock("@/lib/billing/stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/stripe")>();
  return {
    ...actual,
    stripe: () => {
      if (!fake.configured) throw new actual.BillingNotConfigured();
      return fake;
    },
    priceIdFor: (plan: string, interval: string) =>
      plan === "pro" && interval === "monthly" ? "price_pro_monthly" : null,
  };
});

const actions = await import("@/features/billing/actions");
const admin = adminClient();
let owner: TestUser, adminUser: TestUser;
let orgId: string;

beforeAll(async () => {
  [owner, adminUser] = await Promise.all(["ba-owner", "ba-admin"].map(createUser));
  orgId = (await createOrg(owner, "Billing Org", "property", { plan: "free" })).id;
  await addMember(orgId, adminUser, "admin");
});
afterAll(() => cleanup([orgId], [owner, adminUser]));
beforeEach(() => {
  fake.configured = true;
  fake.customers.create.mockReset().mockResolvedValue({ id: "cus_new" });
  fake.checkout.sessions.create.mockReset().mockResolvedValue({ url: "https://checkout.stripe.test/s" });
  fake.billingPortal.sessions.create.mockReset().mockResolvedValue({ url: "https://billing.stripe.test/p" });
});

describe("billing actions", () => {
  it("only owners can start checkout or open the portal", async () => {
    actAs(adminUser);
    expect((await actions.startCheckout({ plan: "pro", interval: "monthly" })).ok).toBe(false);
    expect((await actions.openBillingPortal()).ok).toBe(false);
    expect(fake.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("checkout creates the Stripe customer once, stores it, and tags the session with the org", async () => {
    actAs(owner);
    expect(await actions.startCheckout({ plan: "pro", interval: "monthly" })).toEqual({
      ok: true,
      data: { url: "https://checkout.stripe.test/s" },
    });
    expect(fake.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { org_id: orgId } }),
    );
    expect(fake.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_new",
        client_reference_id: orgId,
        line_items: [{ price: "price_pro_monthly", quantity: 1 }],
        subscription_data: { metadata: { org_id: orgId } },
      }),
    );
    const { data } = await admin
      .from("subscriptions")
      .select("stripe_customer_id, plan")
      .eq("org_id", orgId)
      .single();
    expect(data).toEqual({ stripe_customer_id: "cus_new", plan: "free" }); // the plan changes only via the webhook

    await actions.startCheckout({ plan: "pro", interval: "monthly" });
    expect(fake.customers.create).toHaveBeenCalledTimes(1);
  });

  it("an org that already pays is sent to the portal; unavailable plans and missing config are explained", async () => {
    actAs(owner);
    expect(await actions.startCheckout({ plan: "business", interval: "yearly" })).toEqual({
      ok: false,
      error: "This plan can't be bought online yet — contact us.",
    });
    await admin
      .from("subscriptions")
      .update({ stripe_subscription_id: "sub_1", status: "active", plan: "pro" })
      .eq("org_id", orgId);
    expect(await actions.startCheckout({ plan: "pro", interval: "monthly" })).toEqual({
      ok: true,
      data: { url: "https://billing.stripe.test/p" },
    });
    expect((await actions.openBillingPortal()).ok).toBe(true);
    fake.configured = false;
    expect(await actions.openBillingPortal()).toMatchObject({ ok: false, code: "billing_not_configured" });
  });

  it("set_stripe_customer is owners-only and never overwrites an existing customer", async () => {
    const { error } = await adminUser.client.rpc("set_stripe_customer", {
      p_org: orgId,
      p_customer: "cus_evil",
    });
    expect(error).not.toBeNull();
    await owner.client.rpc("set_stripe_customer", { p_org: orgId, p_customer: "cus_other" });
    expect(
      (await admin.from("subscriptions").select("stripe_customer_id").eq("org_id", orgId).single()).data
        ?.stripe_customer_id,
    ).toBe("cus_new");
    await setPlan(orgId, "free");
  });
});
