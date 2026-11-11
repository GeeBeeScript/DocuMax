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
