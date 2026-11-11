import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * Service-role client — BYPASSES RLS.
 *
 * Allowed only in: the worker, Stripe webhooks, and test setup.
 * Never import from Client Components or user-facing Server Actions.
 * Every query made with it MUST filter by an explicit `org_id`
 * (see docs/MULTI_TENANCY.md → "Service-role rules"). Phase 2 wraps this in
 * an org-scoped repository helper; prefer that once it exists.
 */
export function createSupabaseAdminClient() {
  const env = serverEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
