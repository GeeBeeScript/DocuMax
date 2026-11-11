import type { Metadata } from "next";
import { FormAlert } from "@/components/app/form-alert";
import { StepHeading } from "@/components/app/step-heading";
import { PillButton } from "@/components/brand/pill-button";
import { inviteCopy, roleMeta } from "@/content/app";
import { logOut } from "@/features/auth/actions";
import { AcceptInviteButton } from "@/features/org/components/accept-invite-button";
import { getInvitePreview } from "@/features/org/queries";
import { getUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Join your team", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [preview, user] = await Promise.all([getInvitePreview(token), getUser()]);

  if (!preview) {
    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <StepHeading title={inviteCopy.invalid.title} description={inviteCopy.invalid.description} />
        <PillButton href="/" variant="outline" className="self-start">
          {inviteCopy.back}
        </PillButton>
      </div>
    );
  }

  const next = `/invite/${token}`;
  const roleLabel = roleMeta[preview.role].label.toLowerCase();
  const sameEmail = user?.email?.toLowerCase() === preview.email;

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <StepHeading
        title={inviteCopy.title(preview.org_name)}
        description={inviteCopy.description(roleLabel, preview.email)}
      />
      {!user ? (
        <div className="flex flex-col gap-3">
          <PillButton
            href={`/signup?email=${encodeURIComponent(preview.email)}&next=${encodeURIComponent(next)}`}
            size="lg"
          >
            {inviteCopy.signUp}
          </PillButton>
          <PillButton href={`/login?next=${encodeURIComponent(next)}`} size="lg" variant="outline">
            {inviteCopy.logIn}
          </PillButton>
        </div>
      ) : sameEmail ? (
        <AcceptInviteButton token={token} />
      ) : (
        <div className="flex flex-col gap-4">
          <FormAlert tone="danger">{inviteCopy.wrongAccount(preview.email)}</FormAlert>
          <form action={logOut}>
            <PillButton type="submit" variant="outline">
              {inviteCopy.logOut}
            </PillButton>
          </form>
        </div>
      )}
    </div>
  );
}
