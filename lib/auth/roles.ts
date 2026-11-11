/**
 * Org roles and what they may do. Mirrors the RLS role matrix in supabase/migrations/*_tenancy.sql — the
 * database is the enforcement point; these helpers keep the UI and Server Actions consistent with it.
 */
export const ORG_ROLES = ["owner", "admin", "reviewer", "member", "viewer"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Roles that can be granted through an invite (owner is transferred, never invited). */
export const INVITABLE_ROLES = [
  "admin",
  "reviewer",
  "member",
  "viewer",
] as const satisfies readonly OrgRole[];

export const MEMBER_MANAGERS = ["owner", "admin"] as const satisfies readonly OrgRole[];
/** Manage properties/jobs (PRD: admins manage entities). */
export const ENTITY_MANAGERS = MEMBER_MANAGERS;
export const WRITERS = ["owner", "admin", "reviewer", "member"] as const satisfies readonly OrgRole[];

export function hasRole(role: OrgRole | null | undefined, allowed: readonly OrgRole[]): boolean {
  return role != null && allowed.includes(role);
}

export const canManageMembers = (role: OrgRole | null | undefined) => hasRole(role, MEMBER_MANAGERS);
export const canWrite = (role: OrgRole | null | undefined) => hasRole(role, WRITERS);
export const canManageEntities = (role: OrgRole | null | undefined) => hasRole(role, ENTITY_MANAGERS);

/** Roles `actor` may assign to someone else. Only owners hand out (or take away) ownership. */
export function assignableRoles(actor: OrgRole): readonly OrgRole[] {
  if (actor === "owner") return ORG_ROLES;
  if (actor === "admin") return INVITABLE_ROLES;
  return [];
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Throws ForbiddenError unless `role` is one of `allowed`. */
export function assertRole(
  role: OrgRole | null | undefined,
  allowed: readonly OrgRole[],
): asserts role is OrgRole {
  if (!hasRole(role, allowed)) throw new ForbiddenError();
}
