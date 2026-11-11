import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppNav } from "@/components/app/app-nav";
import { AppSidebar } from "@/components/app/app-sidebar";
import { OrgSwitcher } from "@/components/app/org-switcher";
import { TopBar } from "@/components/app/top-bar";
import { UserMenu } from "@/components/app/user-menu";
import { roleMeta, shellCopy } from "@/content/app";
import { logOut } from "@/features/auth/actions";
import { setActiveOrg } from "@/features/org/actions";
import { requireActiveOrg } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · DocuMax" },
  robots: { index: false },
};

async function switchOrg(orgId: string) {
  "use server";
  return setActiveOrg({ orgId });
}

/** Authenticated app shell: sidebar (desktop) / drawer (mobile), top bar, content. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireActiveOrg();
  const orgs = ctx.memberships.map((m) => ({
    id: m.org.id,
    name: m.org.name,
    roleLabel: roleMeta[m.role].label,
  }));
  const sidebar = (
    <AppSidebar
      switcher={
        <OrgSwitcher orgs={orgs} activeId={ctx.org.id} onSwitch={switchOrg} labels={shellCopy.orgSwitcher} />
      }
      nav={<AppNav />}
    />
  );

  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-gray-200 bg-paper lg:block">
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-col">
        <TopBar
          menuLabel={shellCopy.openNav}
          drawer={sidebar}
          actions={
            <UserMenu
              name={ctx.profile.full_name}
              email={ctx.email}
              onLogOut={logOut}
              labels={shellCopy.userMenu}
            />
          }
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
