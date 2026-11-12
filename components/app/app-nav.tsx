"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { appNav, type AppNavItem } from "@/content/app";
import type { OrgRole } from "@/lib/auth/roles";
import { entityLabels, type EntityKind } from "@/lib/entities/labels";
import { cn } from "@/lib/utils";

/**
 * Sidebar navigation list; the active item gets the yellow-soft highlight. Reads `content/app.ts` itself
 * because nav items hold icon components, which can't be passed from a Server Component as props.
 * Entity wording/icons follow the org's mode; items limited to some roles are hidden from the others.
 */
export function AppNav({
  entityKind,
  role,
  items = appNav,
}: {
  entityKind: EntityKind;
  role?: OrgRole;
  items?: readonly AppNavItem[];
}) {
  const pathname = usePathname();
  const labels = entityLabels(entityKind);
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-1">
        {items
          .filter((item) => !item.roles || (role != null && item.roles.includes(role)))
          .map((item) => {
            const active = isActive(item.href);
            const Icon = item.iconByKind?.[entityKind] ?? item.icon;
            const label = typeof item.label === "function" ? item.label(labels) : item.label;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-ink-soft transition-colors hover:bg-gray-100 hover:text-ink",
                    active && "bg-yellow-soft text-ink hover:bg-yellow-soft",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}
