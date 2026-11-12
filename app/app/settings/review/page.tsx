import type { Metadata } from "next";
import { FormAlert } from "@/components/app/form-alert";
import { PageHeader } from "@/components/app/page-header";
import { reviewSettingsCopy } from "@/content/app";
import { ReviewSettingsForm } from "@/features/org/components/review-settings-form";
import { canManageMembers } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";

export const metadata: Metadata = { title: reviewSettingsCopy.title };

export default async function ReviewSettingsPage() {
  const ctx = await requireActiveOrg();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={reviewSettingsCopy.title} description={reviewSettingsCopy.description} />
      {canManageMembers(ctx.role) ? (
        <ReviewSettingsForm threshold={Number(ctx.org.review_threshold)} autoApprove={ctx.org.auto_approve} />
      ) : (
        <FormAlert tone="info">{reviewSettingsCopy.forbidden}</FormAlert>
      )}
    </div>
  );
}
