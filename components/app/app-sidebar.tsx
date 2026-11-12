import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * Left sidebar (Miro dashboard pattern): logo, workspace switcher, navigation. Slots keep it free of data
 * fetching; the layout passes the switcher and nav in.
 */
export function AppSidebar({
  switcher,
  nav,
  footer,
  className,
}: {
  switcher: ReactNode;
  nav: ReactNode;
  /** Pinned to the bottom (usage meter). */
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col gap-6 p-4", className)}>
      <Link href="/app" aria-label="DocuMax dashboard" className="self-start px-2 pt-1">
        <Logo />
      </Link>
      {switcher}
      {nav}
      {footer && <div className="mt-auto">{footer}</div>}
    </div>
  );
}
