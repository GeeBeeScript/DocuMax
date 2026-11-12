import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

/**
 * E2E-only service-role helpers (tests may use the service role — CLAUDE.md non-negotiable 1). They stand in for
 * Stripe, which E2E never calls: an org's plan is set as if the webhook had arrived.
 */
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

/** The org owned by the user with this email (the most recent one). */
export async function orgOfOwner(email: string): Promise<string> {
  const db = admin();
  const { data: profile } = await db.from("profiles").select("id").eq("email", email).single();
  const { data } = await db
    .from("memberships")
    .select("org_id")
    .eq("user_id", profile!.id)
    .eq("role", "owner")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data!.org_id;
}

export async function setPlan(orgId: string, plan: "free" | "pro" | "business" | "enterprise") {
  const { error } = await admin()
    .from("subscriptions")
    .upsert({ org_id: orgId, plan, status: "active" }, { onConflict: "org_id" });
  if (error) throw error;
}

/** Pretend `used` documents were already processed this month. */
export async function setDocumentsUsed(orgId: string, used: number) {
  const db = admin();
  const { data: period } = await db.rpc("org_usage_period", { p_org: orgId });
  const { error } = await db
    .from("usage_counters")
    .upsert(
      { org_id: orgId, period_start: period, documents_used: used },
      { onConflict: "org_id,period_start" },
    );
  if (error) throw error;
}
