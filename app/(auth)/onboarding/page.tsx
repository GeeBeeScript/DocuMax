import type { Metadata } from "next";
import { StepHeading } from "@/components/app/step-heading";
import { onboardingCopy } from "@/content/app";
import { CreateOrgForm } from "@/features/org/components/create-org-form";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create your organization", robots: { index: false } };

export default async function OnboardingPage() {
  await requireUser("/onboarding");
  const copy = onboardingCopy.org;
  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <StepHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <CreateOrgForm />
    </div>
  );
}
