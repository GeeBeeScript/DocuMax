import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { PillButton } from "@/components/brand/pill-button";
import { authNav } from "@/content/nav";
import { DesktopNav } from "./desktop-nav";
import { HeaderShell } from "./header-shell";
import { MobileNavLazy } from "./mobile-nav-lazy";

/**
 * Sticky marketing header (Server Component). Nav menus are client components that read
 * `content/nav.ts` directly — nav items contain icon components, which can't cross the
 * server→client boundary as props.
 */
export function SiteHeader() {
  const { login, contact, signup } = authNav;
  return (
    <HeaderShell>
      <Link href="/" aria-label="DocuMax home" className="shrink-0">
        <Logo />
      </Link>

      <DesktopNav className="hidden lg:flex" />

      <div className="ml-auto hidden items-center gap-2 lg:flex">
        <PillButton href={contact.href} variant="ghost" size="sm">
          {contact.label}
        </PillButton>
        <PillButton href={login.href} variant="ghost" size="sm">
          {login.label}
        </PillButton>
        <PillButton href={signup.href} size="sm">
          {signup.label}
        </PillButton>
      </div>

      <div className="ml-auto flex items-center gap-1 lg:hidden">
        <PillButton href={signup.href} size="sm" className="hidden sm:inline-flex">
          {signup.label}
        </PillButton>
        <MobileNavLazy />
      </div>
    </HeaderShell>
  );
}
