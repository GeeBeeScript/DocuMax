"use client";

import dynamic from "next/dynamic";
import { Menu } from "lucide-react";

/** Same footprint as the real trigger so there is no layout shift while the drawer code loads. */
function MenuPlaceholder() {
  return (
    <span aria-hidden className="inline-flex size-11 items-center justify-center rounded-full text-ink">
      <Menu className="size-5" />
    </span>
  );
}

/**
 * The mobile drawer (Sheet + Accordion) is only needed below `lg`, so it is code-split and
 * loaded after hydration instead of adding to every page's initial JS.
 */
export const MobileNavLazy = dynamic(() => import("./mobile-nav").then((m) => m.MobileNav), {
  ssr: false,
  loading: MenuPlaceholder,
});
