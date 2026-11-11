"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Top bar of the app shell. Below `lg` it carries the menu button that opens the sidebar (`drawer`) in a
 * sheet; the sheet closes itself when navigation changes the route.
 */
export function TopBar({
  drawer,
  actions,
  menuLabel,
}: {
  drawer: ReactNode;
  actions?: ReactNode;
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-paper/95 px-4 backdrop-blur sm:px-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          aria-label={menuLabel}
          className="inline-flex size-10 items-center justify-center rounded-lg text-ink hover:bg-gray-100 lg:hidden"
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-paper p-0">
          <SheetTitle className="sr-only">{menuLabel}</SheetTitle>
          {drawer}
        </SheetContent>
      </Sheet>
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </header>
  );
}
