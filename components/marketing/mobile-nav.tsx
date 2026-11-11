"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Logo } from "@/components/brand/logo";
import { PillButton } from "@/components/brand/pill-button";
import { authNav, mainNav } from "@/content/nav";
import type { Link as LinkType, NavEntry } from "@/content/types";

/** Mobile navigation drawer: accordion groups + auth actions. */
export function MobileNav({
  items = mainNav,
  login = authNav.login,
  signup = authNav.signup,
}: {
  items?: readonly NavEntry[];
  login?: LinkType;
  signup?: LinkType;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-gray-100"
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto bg-paper p-6">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <Logo />
        <Accordion className="mt-4">
          {items.map((entry) =>
            entry.kind === "menu" ? (
              <AccordionItem key={entry.label} value={entry.label}>
                <AccordionTrigger className="py-4 font-heading text-base font-semibold hover:no-underline">
                  {entry.label}
                </AccordionTrigger>
                <AccordionContent className="[&_a]:no-underline">
                  {entry.columns.map((col) => (
                    <div key={col.heading} className="mb-3">
                      <p className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                        {col.heading}
                      </p>
                      <ul>
                        {col.items.map((item) => (
                          <li key={item.label}>
                            <Link
                              href={item.href}
                              onClick={close}
                              className="flex items-center gap-2 rounded-lg py-2 text-sm text-ink hover:bg-gray-100"
                            >
                              {item.icon && <item.icon className="size-4 text-ink-soft" />}
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ) : (
              <Link
                key={entry.label}
                href={entry.href}
                onClick={close}
                className="block border-b py-4 font-heading text-base font-semibold text-ink"
              >
                {entry.label}
              </Link>
            ),
          )}
        </Accordion>
        <div className="mt-6 flex flex-col gap-3">
          <PillButton href={signup.href} onClick={close} size="lg">
            {signup.label}
          </PillButton>
          <PillButton href={login.href} onClick={close} size="lg" variant="outline">
            {login.label}
          </PillButton>
        </div>
      </SheetContent>
    </Sheet>
  );
}
