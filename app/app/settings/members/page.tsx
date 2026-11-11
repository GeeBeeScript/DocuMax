import type { Metadata } from "next";
import { FormAlert } from "@/components/app/form-alert";
import { PageHeader } from "@/components/app/page-header";
import { membersCopy } from "@/content/app";
import { InviteForm } from "@/features/org/components/invite-form";
import { MemberList } from "@/features/org/components/member-list";
import { PendingInvites } from "@/features/org/components/pending-invites";
import { listMembers, listPendingInvites } from "@/features/org/queries";
import { canManageMembers } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";

export const metadata: Metadata = { title: membersCopy.title };

export default async function MembersPage() {
  const ctx = await requireActiveOrg();
  const manager = canManageMembers(ctx.role);
  const [members, invites] = await Promise.all([
    listMembers(ctx.org.id),
    manager ? listPendingInvites(ctx.org.id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={membersCopy.title} description={membersCopy.description} />
      {manager ? <InviteForm /> : <FormAlert tone="info">{membersCopy.readOnly}</FormAlert>}
      <section aria-labelledby="members-heading" className="flex flex-col gap-3">
        <h2 id="members-heading" className="text-lg font-bold">
          {membersCopy.membersHeading} ({members.length})
        </h2>
        <MemberList members={members} viewerId={ctx.userId} viewerRole={ctx.role} />
      </section>
      {manager && (
        <section aria-labelledby="invites-heading" className="flex flex-col gap-3">
          <h2 id="invites-heading" className="text-lg font-bold">
            {membersCopy.invitesHeading}
          </h2>
          <PendingInvites invites={invites} />
        </section>
      )}
    </div>
  );
}
