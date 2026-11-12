import "server-only";
import type { PlanId } from "@/lib/billing/plans";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface Usage {
  plan: PlanId;
  documentsUsed: number;
  /** null = unlimited */
  documentsCap: number | null;
  seatsUsed: number;
  seatsCap: number | null;
  periodStart: string;
}

export interface BillingState {
  usage: Usage;
  status: string;
  interval: "monthly" | "yearly" | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  paymentFailed: boolean;
  hasCustomer: boolean;
}

/** This month's usage and the effective plan (members; the database decides the plan from Stripe's status). */
export async function getUsage(orgId: string): Promise<Usage> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("org_usage", { p_org: orgId }).single();
  if (error) throw error;
  return {
    plan: data.plan as PlanId,
    documentsUsed: data.documents_used,
    documentsCap: data.documents_cap,
    seatsUsed: data.seats_used,
    seatsCap: data.seats_cap,
    periodStart: data.period_start,
  };
}

export async function getBillingState(orgId: string): Promise<BillingState> {
  const supabase = await createSupabaseServerClient();
  const [usage, { data: sub }] = await Promise.all([
    getUsage(orgId),
    supabase
      .from("subscriptions")
      .select(
        "status, billing_interval, current_period_end, cancel_at_period_end, payment_failed_at, stripe_customer_id",
      )
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);
  return {
    usage,
    status: sub?.status ?? "none",
    interval: (sub?.billing_interval as BillingState["interval"]) ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
    cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
    paymentFailed: !!sub?.payment_failed_at,
    hasCustomer: !!sub?.stripe_customer_id,
  };
}
