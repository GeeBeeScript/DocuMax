import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/auth/roles";

export interface MemberRow {
  membershipId: string;
  userId: string;
  role: OrgRole;
  name: string | null;
  email: string;
  joinedAt: string;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: OrgRole;
  expiresAt: string;
}

/** Members of an org (RLS: caller must be a member). */
export async function listMembers(orgId: string): Promise<MemberRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("id, user_id, role, created_at, profile:profiles!inner(full_name, email)")
    .eq("org_id", orgId)
    .order("created_at");
  if (error) throw error;
  return data.map((m) => ({
    membershipId: m.id,
    userId: m.user_id,
    role: m.role,
    name: m.profile.full_name,
    email: m.profile.email,
    joinedAt: m.created_at,
  }));
}

/** Open, unexpired invites (RLS: owners/admins only — others get an empty list). */
export async function listPendingInvites(orgId: string): Promise<PendingInvite[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invites")
    .select("id, email, role, expires_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expires_at }));
}

export async function getInvitePreview(token: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("invite_preview", { p_token: token });
  if (error) throw error;
  const preview = data[0];
  return preview && !preview.expired && !preview.accepted ? preview : null;
}
