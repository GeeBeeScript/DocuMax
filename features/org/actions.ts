"use server";

import { purgePrefix, type StorageBucketLike } from "@/lib/storage/purge";
import { RATE_LIMITED } from "@/lib/security/rate-limit";
import { allow } from "@/lib/security/rate-limit.server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, failCode, invalid, ok, type ActionResult } from "@/lib/actions/result";
import { billingCopy } from "@/content/app";
import { requireActiveOrg, requireUser } from "@/lib/auth/session";
import {
  assignableRoles,
  canManageMembers,
  ForbiddenError,
  MEMBER_MANAGERS,
  assertRole,
} from "@/lib/auth/roles";
import { clientEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createInviteToken } from "./invite-token";
import {
  AcceptInviteSchema,
  ChangeRoleSchema,
  CreateOrgSchema,
  InviteIdSchema,
  InviteMemberSchema,
  DeleteOrganizationSchema,
  MembershipIdSchema,
  OrganizationSettingsSchema,
  ReviewSettingsSchema,
  SetActiveOrgSchema,
} from "./schema";

/*
 * Org Server Actions. Pattern (docs/CONVENTIONS.md): parse → user + active org → role check → write
 * (RLS enforces again) → revalidate → ActionResult. The org always comes from the server-side session,
 * never from client input. Audit rows are written by the database trigger.
 */

const FORBIDDEN = new ForbiddenError().message;
const MEMBERS_PATH = "/app/settings/members";

/** Postgres error → user-safe message. */
function dbError(error: { code?: string; message: string }): ReturnType<typeof fail> {
  if (error.code === "42501") return fail(FORBIDDEN);
  if (error.code === "23505") return fail("That already exists.");
  if (error.code === "23514" || error.code === "P0002") return fail(error.message.replace(/^.*?: /, ""));
  return fail("Something went wrong. Please try again.");
}

export async function createOrganization(input: unknown): Promise<ActionResult> {
  const parsed = CreateOrgSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await requireUser();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_entity_kind: parsed.data.entityKind,
  });
  if (error) return dbError(error);
  revalidatePath("/app", "layout");
  redirect("/onboarding/invite");
}

export async function setActiveOrg(input: unknown): Promise<ActionResult> {
  const parsed = SetActiveOrgSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const user = await requireUser();

  const supabase = await createSupabaseServerClient();
  // RLS (profiles_update with check) rejects orgs the user doesn't belong to.
  const { error } = await supabase
    .from("profiles")
    .update({ last_org_id: parsed.data.orgId })
    .eq("id", user.id);
  if (error) return dbError(error);
  revalidatePath("/app", "layout");
  return ok();
}

export async function inviteMember(input: unknown): Promise<ActionResult<{ inviteUrl: string }>> {
  const parsed = InviteMemberSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await requireActiveOrg();
  if (!canManageMembers(ctx.role)) return fail(FORBIDDEN);
  if (!(await allow("invite", ctx.userId))) return fail(RATE_LIMITED);

  const supabase = await createSupabaseServerClient();
  const { token, hash } = createInviteToken();
  // Re-inviting an address replaces its open invite (new link, fresh expiry).
  await supabase
    .from("invites")
    .delete()
    .eq("org_id", ctx.org.id)
    .eq("email", parsed.data.email)
    .is("accepted_at", null);
  const { error } = await supabase.from("invites").insert({
    org_id: ctx.org.id,
    email: parsed.data.email,
    role: parsed.data.role,
    token_hash: hash,
    invited_by: ctx.userId,
  });
  if (error?.message === "seat_limit") {
    return failCode("seat_limit", billingCopy.seatLimit(Number(error.hint) || 1));
  }
  if (error) return dbError(error);

  revalidatePath(MEMBERS_PATH);
  return ok({ inviteUrl: new URL(`/invite/${token}`, clientEnv().NEXT_PUBLIC_APP_URL).toString() });
}

export async function revokeInvite(input: unknown): Promise<ActionResult> {
  const parsed = InviteIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await requireActiveOrg();
  if (!canManageMembers(ctx.role)) return fail(FORBIDDEN);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invites")
    .delete()
    .eq("id", parsed.data.inviteId)
    .eq("org_id", ctx.org.id)
    .select("id");
  if (error) return dbError(error);
  if (!data.length) return fail("Invite not found.");
  revalidatePath(MEMBERS_PATH);
  return ok();
}

export async function changeMemberRole(input: unknown): Promise<ActionResult> {
  const parsed = ChangeRoleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await requireActiveOrg();
  try {
    assertRole(ctx.role, MEMBER_MANAGERS);
  } catch {
    return fail(FORBIDDEN);
  }
  if (!assignableRoles(ctx.role).includes(parsed.data.role)) return fail(FORBIDDEN);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("memberships")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.membershipId)
    .eq("org_id", ctx.org.id)
    .select("id");
  if (error) return dbError(error);
  if (!data.length) return fail("Member not found.");
  revalidatePath(MEMBERS_PATH);
  return ok();
}

/** Removes a member — or, when it's the caller's own membership, leaves the organization. */
export async function removeMember(input: unknown): Promise<ActionResult> {
  const parsed = MembershipIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await requireActiveOrg();

  const supabase = await createSupabaseServerClient();
  const { data: target } = await supabase
    .from("memberships")
    .select("id, user_id")
    .eq("id", parsed.data.membershipId)
    .eq("org_id", ctx.org.id)
    .maybeSingle();
  if (!target) return fail("Member not found.");
  const leaving = target.user_id === ctx.userId;
  if (!leaving && !canManageMembers(ctx.role)) return fail(FORBIDDEN);

  const { data, error } = await supabase.from("memberships").delete().eq("id", target.id).select("id");
  if (error) return dbError(error);
  if (!data.length) return fail(FORBIDDEN);

  if (leaving) {
    revalidatePath("/app", "layout");
    redirect("/app");
  }
  revalidatePath(MEMBERS_PATH);
  return ok();
}

export async function acceptInvite(input: unknown): Promise<ActionResult> {
  const parsed = AcceptInviteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await requireUser(`/invite/${parsed.data.token}`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: parsed.data.token });
  if (error) {
    if (/different email/.test(error.message))
      return fail("This invite was sent to a different email address.");
    if (error.code === "P0002") return fail("This invite is invalid or has expired.");
    if (error.message === "seat_limit") {
      return failCode("seat_limit", billingCopy.seatLimit(Number(error.hint) || 1));
    }
    return dbError(error);
  }
  revalidatePath("/app", "layout");
  redirect("/app");
}

/** Review threshold + auto-approve (owners/admins; the organizations update policy enforces it again). */
export async function updateReviewSettings(input: unknown): Promise<ActionResult> {
  const parsed = ReviewSettingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await requireActiveOrg();
  if (!canManageMembers(ctx.role)) return fail(FORBIDDEN);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({
      review_threshold: parsed.data.thresholdPercent / 100,
      auto_approve: parsed.data.autoApprove,
    })
    .eq("id", ctx.org.id)
    .select("id");
  if (error) return dbError(error);
  if (!data.length) return fail(FORBIDDEN);
  revalidatePath("/app", "layout");
  return ok();
}

/** Branding (logo, colour, footer) and time zone. Owners/admins; the logo was uploaded by the browser first. */
export async function updateOrganizationSettings(input: unknown): Promise<ActionResult> {
  const parsed = OrganizationSettingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await requireActiveOrg();
  if (!canManageMembers(ctx.role)) return fail(FORBIDDEN);
  const { logoPath, brandColor, footerText, timezone } = parsed.data;
  if (logoPath && !logoPath.startsWith(`${ctx.org.id}/`)) return fail(FORBIDDEN);

  const supabase = await createSupabaseServerClient();
  if (logoPath && logoPath !== ctx.org.logo_path) {
    const folder = await supabase.storage
      .from("branding")
      .list(ctx.org.id, { search: logoPath.split("/")[1] });
    if (!folder.data?.some((f) => `${ctx.org.id}/${f.name}` === logoPath))
      return fail("Upload the logo again.");
  }
  const { data, error } = await supabase
    .from("organizations")
    .update({ logo_path: logoPath, brand_color: brandColor, footer_text: footerText || null, timezone })
    .eq("id", ctx.org.id)
    .select("id");
  if (error) return dbError(error);
  if (!data.length) return fail(FORBIDDEN);
  // The previous logo is no longer referenced.
  if (ctx.org.logo_path && ctx.org.logo_path !== logoPath) {
    await supabase.storage.from("branding").remove([ctx.org.logo_path]);
  }
  revalidatePath("/app", "layout");
  return ok();
}

const BUCKETS = ["documents", "reports", "imports", "branding"] as const;

/**
 * Owners: permanently delete the active organization — every stored file under `{org_id}/` in each bucket, then
 * the organization row (all tenant data cascades). The typed name must match. Irreversible.
 */
export async function deleteOrganization(input: unknown): Promise<ActionResult> {
  const parsed = DeleteOrganizationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const ctx = await requireActiveOrg();
  if (ctx.role !== "owner") return fail(FORBIDDEN);
  if (parsed.data.confirmName !== ctx.org.name.trim()) {
    return fail("Type the organization's name exactly to confirm.", {
      confirmName: ["The name doesn't match."],
    });
  }

  const supabase = await createSupabaseServerClient();
  try {
    for (const bucket of BUCKETS) {
      await purgePrefix(supabase.storage.from(bucket) as unknown as StorageBucketLike, ctx.org.id);
    }
  } catch {
    return fail("Some files couldn't be deleted. Nothing else was removed — please try again.");
  }
  const { data, error } = await supabase.from("organizations").delete().eq("id", ctx.org.id).select("id");
  if (error) return dbError(error);
  if (!data.length) return fail(FORBIDDEN);
  console.info("organization deleted", { orgId: ctx.org.id, by: ctx.userId });
  revalidatePath("/app", "layout");
  redirect("/app");
}
