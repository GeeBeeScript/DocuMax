"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { mainNav } from "@/content/nav";
import type { NavEntry, NavMenuGroup } from "@/content/types";
import { cn } from "@/lib/utils";

const triggerClass =
  "h-10 rounded-full bg-transparent px-4 font-heading text-[0.9375rem] font-semibold text-ink hover:bg-gray-100 data-popup-open:bg-gray-100";

function MegaMenuPanel({ group }: { group: NavMenuGroup }) {
  return (
    <div className={cn("grid gap-6 p-6", group.featured ? "w-[720px] grid-cols-3" : "w-[560px] grid-cols-2")}>
      {group.columns.map((col) => (
        <div key={col.heading} className={cn(group.columns.length === 1 && "col-span-2")}>
          <p className="mb-3 px-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">{col.heading}</p>
          <ul className={cn("grid gap-1", group.columns.length === 1 && "grid-cols-2")}>
            {col.items.map((item) => (
              <li key={item.label}>
                <NavigationMenuLink
                  render={<Link href={item.href} />}
                  className="flex items-start gap-3 rounded-xl p-2 hover:bg-gray-100"
                >
                  {item.icon && (
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-yellow-soft text-ink">
                      <item.icon className="size-4" />
                    </span>
                  )}
                  <span className="flex flex-col">
                    <span className="font-heading text-sm font-semibold text-ink">{item.label}</span>
                    {item.description && <span className="text-xs text-gray-500">{item.description}</span>}
                  </span>
                </NavigationMenuLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {group.featured && (
        <NavigationMenuLink
          render={<Link href={group.featured.href} />}
          className="flex flex-col items-start justify-end gap-2 rounded-2xl bg-yellow p-5 hover:bg-yellow-hover"
        >
          <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-paper">{group.featured.eyebrow}</span>
          <span className="font-heading text-lg font-bold text-ink">{group.featured.title}</span>
          <span className="text-sm text-ink-soft">{group.featured.description}</span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink">
            Learn more <ArrowRight className="size-3.5" />
          </span>
        </NavigationMenuLink>
      )}
    </div>
  );
}

/** Desktop primary navigation with mega-menus (Base UI NavigationMenu: hover + keyboard accessible). */
export function DesktopNav({
  items = mainNav,
  className,
}: {
  items?: readonly NavEntry[];
  className?: string;
}) {
  return (
    <NavigationMenu className={className}>
      <NavigationMenuList className="gap-1">
        {items.map((entry) =>
          entry.kind === "menu" ? (
            <NavigationMenuItem key={entry.label}>
              <NavigationMenuTrigger className={triggerClass}>{entry.label}</NavigationMenuTrigger>
              <NavigationMenuContent>
                <MegaMenuPanel group={entry} />
              </NavigationMenuContent>
            </NavigationMenuItem>
          ) : (
            <NavigationMenuItem key={entry.label}>
              <NavigationMenuLink render={<Link href={entry.href} />} className={cn(triggerClass, "inline-flex items-center")}>
                {entry.label}
              </NavigationMenuLink>
            </NavigationMenuItem>
          ),
        )}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
