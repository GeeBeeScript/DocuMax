import type { Metadata } from "next";
import { StepHeading } from "@/components/app/step-heading";
import { PillButton } from "@/components/brand/pill-button";
import { onboardingCopy } from "@/content/app";
import { InviteForm } from "@/features/org/components/invite-form";
import { requireActiveOrg } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Invite your team", robots: { index: false } };

export default async function OnboardingInvitePage() {
  await requireActiveOrg();
  const copy = onboardingCopy.invite;
  return (
    <div className="flex w-full max-w-xl flex-col gap-8">
      <StepHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <InviteForm />
      <div className="flex flex-wrap gap-3">
        <PillButton href="/app" size="lg">
          {copy.done}
        </PillButton>
        <PillButton href="/app" size="lg" variant="ghost">
          {copy.skip}
        </PillButton>
      </div>
    </div>
  );
}
