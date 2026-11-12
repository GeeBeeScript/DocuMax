import type { Metadata } from "next";
import { FormAlert } from "@/components/app/form-alert";
import { PageHeader } from "@/components/app/page-header";
import { organizationCopy } from "@/content/app";
import { DeleteOrganization } from "@/features/org/components/delete-organization";
import { OrganizationForm } from "@/features/org/components/organization-form";
import { DEFAULT_BRAND_COLOR } from "@/pdf/components/brand-bar";
import { canManageMembers } from "@/lib/auth/roles";
import { requireActiveOrg } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: organizationCopy.title };

export default async function OrganizationSettingsPage() {
  const ctx = await requireActiveOrg();
  if (!canManageMembers(ctx.role)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={organizationCopy.title} />
        <FormAlert tone="info">{organizationCopy.forbidden}</FormAlert>
      </div>
    );
  }
  const logoUrl = ctx.org.logo_path
    ? ((
        await (
          await createSupabaseServerClient()
        ).storage
          .from("branding")
          .createSignedUrl(ctx.org.logo_path, 300)
      ).data?.signedUrl ?? null)
    : null;
  const timeZones = ["UTC", ...Intl.supportedValuesOf("timeZone").filter((tz) => tz !== "UTC")];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={organizationCopy.title} description={organizationCopy.description} />
      <OrganizationForm
        orgId={ctx.org.id}
        orgName={ctx.org.name}
        logoUrl={logoUrl}
        timeZones={timeZones}
        initial={{
          logoPath: ctx.org.logo_path,
          brandColor: ctx.org.brand_color ?? DEFAULT_BRAND_COLOR,
          footerText: ctx.org.footer_text ?? "",
          timezone: ctx.org.timezone,
        }}
      />
      {ctx.role === "owner" && <DeleteOrganization orgName={ctx.org.name} />}
    </div>
  );
}
