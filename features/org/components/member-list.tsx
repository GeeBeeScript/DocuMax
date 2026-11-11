import { initials } from "@/components/app/initials";
import { membersCopy, roleMeta } from "@/content/app";
import { assignableRoles, canManageMembers, type OrgRole } from "@/lib/auth/roles";
import type { MemberRow } from "../queries";
import { MemberRowActions } from "./member-row-actions";

/** Members of the active org; row actions only where the viewer's role allows them. */
export function MemberList({
  members,
  viewerId,
  viewerRole,
}: {
  members: MemberRow[];
  viewerId: string;
  viewerRole: OrgRole;
}) {
  const manager = canManageMembers(viewerRole);
  const ownerCount = members.filter((m) => m.role === "owner").length;
  return (
    <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-paper">
      {members.map((m) => {
        const isSelf = m.userId === viewerId;
        const display = m.name ?? m.email;
        // Admins can't act on owners; owners can act on anyone (the database keeps the last owner).
        const actsOnOwner = m.role === "owner" && viewerRole !== "owner";
        const assignable = manager && !actsOnOwner && !isSelf ? assignableRoles(viewerRole) : [];
        return (
          <li key={m.membershipId} className="flex flex-wrap items-center gap-4 px-4 py-3">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-note-blue font-heading text-sm font-bold"
            >
              {initials(m.name, m.email)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">
                {display}
                {isSelf && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({membersCopy.you})</span>
                )}
              </span>
              {m.name && <span className="truncate text-sm text-muted-foreground">{m.email}</span>}
            </div>
            {manager || isSelf ? (
              <MemberRowActions
                membershipId={m.membershipId}
                name={display}
                role={m.role}
                assignable={assignable}
                // The database keeps at least one owner; don't offer "leave" to the last one.
                canRemove={isSelf ? !(m.role === "owner" && ownerCount === 1) : manager && !actsOnOwner}
                isSelf={isSelf}
              />
            ) : (
              <span className="text-sm text-muted-foreground">{roleMeta[m.role].label}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
