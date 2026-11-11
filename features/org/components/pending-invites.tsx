import { membersCopy, roleMeta } from "@/content/app";
import type { PendingInvite } from "../queries";
import { RevokeInviteButton } from "./revoke-invite-button";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function PendingInvites({ invites }: { invites: PendingInvite[] }) {
  if (invites.length === 0) return <p className="text-sm text-muted-foreground">{membersCopy.noInvites}</p>;
  return (
    <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-paper">
      {invites.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-semibold">{i.email}</span>
            <span className="text-sm text-muted-foreground">
              {roleMeta[i.role].label} · {membersCopy.expires(dateFormat.format(new Date(i.expiresAt)))}
            </span>
          </div>
          <RevokeInviteButton inviteId={i.id} email={i.email} />
        </li>
      ))}
    </ul>
  );
}
