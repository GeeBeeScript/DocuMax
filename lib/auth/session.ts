import "server-only";
import { setOrgContext } from "@/lib/observability/context";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { OrgRole } from "./roles";

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface OrgMembership {
  role: OrgRole;
  org: Organization;
}

export interface ActiveOrgContext {
  userId: string;
  email: string;
  profile: Profile;
  org: Organization;
  role: OrgRole;
  memberships: OrgMembership[];
}

/** The signed-in user (verified with the auth server), or null. Cached per request. */
export const getUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/** The signed-in user, or a redirect to /login (preserving where they were going). */
export async function requireUser(next?: string) {
  const user = await getUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/** All of the user's orgs with their role in each, oldest first. RLS limits this to their own memberships. */
export const getMemberships = cache(async (userId: string): Promise<OrgMembership[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, org:organizations!inner(*)")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((m) => ({ role: m.role, org: m.org }));
});

/**
 * The org the user is working in: `profiles.last_org_id` if they're still a member, else their first org.
 * `last_org_id` is only a preference — membership (and RLS) decides access. Returns null when the user
 * belongs to no organization yet (→ onboarding).
 */
export const getActiveOrg = cache(async (): Promise<ActiveOrgContext | null> => {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const [memberships, profileRes] = await Promise.all([
    getMemberships(user.id),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (memberships.length === 0) return null;

  const active = memberships.find((m) => m.org.id === profileRes.data.last_org_id) ?? memberships[0];
  return {
    userId: user.id,
    email: user.email ?? profileRes.data.email,
    profile: profileRes.data,
    org: active.org,
    role: active.role,
    memberships,
  };
});

/** Active org context or a redirect to onboarding. For pages inside /app. */
export async function requireActiveOrg(): Promise<ActiveOrgContext> {
  const ctx = await getActiveOrg();
  if (!ctx) redirect("/onboarding");
  setOrgContext(ctx.org.id);
  return ctx;
}
