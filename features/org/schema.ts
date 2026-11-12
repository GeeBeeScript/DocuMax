import { z } from "zod";
import { ENTITY_KINDS } from "@/lib/entities/labels";
import { INVITABLE_ROLES, ORG_ROLES } from "@/lib/auth/roles";

export const CreateOrgSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(120),
  entityKind: z.enum(ENTITY_KINDS, "Choose what you track costs for."),
});

export const SetActiveOrgSchema = z.object({ orgId: z.uuid() });

export const InviteMemberSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  role: z.enum(INVITABLE_ROLES),
});

export const ChangeRoleSchema = z.object({ membershipId: z.uuid(), role: z.enum(ORG_ROLES) });
export const MembershipIdSchema = z.object({ membershipId: z.uuid() });
export const InviteIdSchema = z.object({ inviteId: z.uuid() });
export const AcceptInviteSchema = z.object({ token: z.string().min(16).max(128) });

export type CreateOrgInput = z.infer<typeof CreateOrgSchema>;
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

export const ReviewSettingsSchema = z.object({
  /** Shown as a percentage; stored as 0–1 in organizations.review_threshold. */
  thresholdPercent: z.number("Enter a whole number from 50 to 100.").int().min(50).max(100),
  autoApprove: z.boolean(),
});
export type ReviewSettingsInput = z.infer<typeof ReviewSettingsSchema>;

/** IANA zones known to this runtime (plus UTC). */
export function isTimeZone(value: string): boolean {
  if (value === "UTC") return true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const OrganizationSettingsSchema = z.object({
  /** `{org_id}/logo-….png|jpg|jpeg|webp` in the branding bucket, or null to remove it. */
  logoPath: z
    .string()
    .regex(/^[0-9a-f-]{36}\/logo-[\w-]{1,60}\.(png|jpe?g|webp)$/i, "Upload a PNG, JPG or WEBP logo.")
    .nullable(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a colour."),
  footerText: z.string().trim().max(200, "Keep the footer under 200 characters."),
  timezone: z.string().refine(isTimeZone, "Choose a time zone."),
});
export type OrganizationSettingsInput = z.infer<typeof OrganizationSettingsSchema>;
