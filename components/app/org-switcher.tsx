"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface OrgOption {
  id: string;
  name: string;
  roleLabel: string;
}

/**
 * Workspace switcher (Miro's top-left board switcher). Switching calls `onSwitch` (a Server Action passed in
 * by the layout), which updates the user's active-org preference.
 */
export function OrgSwitcher({
  orgs,
  activeId,
  onSwitch,
  labels,
}: {
  orgs: readonly OrgOption[];
  activeId: string;
  onSwitch: (orgId: string) => Promise<unknown>;
  labels: { label: string; create: string };
}) {
  const [pending, startTransition] = useTransition();
  const active = orgs.find((o) => o.id === activeId) ?? orgs[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={labels.label}
        disabled={pending}
        className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-paper p-2 text-left hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-ink/30 focus-visible:outline-none"
      >
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink font-heading text-sm font-bold text-yellow"
        >
          {active.name.charAt(0).toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-ink">{active.name}</span>
          <span className="text-xs text-muted-foreground">{active.roleLabel}</span>
        </span>
        <ChevronsUpDown className="size-4 text-gray-500" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{labels.label}</DropdownMenuLabel>
          {orgs.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() =>
                org.id !== activeId && startTransition(() => onSwitch(org.id).then(() => undefined))
              }
              className="gap-2"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{org.name}</span>
                <span className="text-xs text-muted-foreground">{org.roleLabel}</span>
              </span>
              <Check className={cn("size-4", org.id !== activeId && "invisible")} aria-hidden />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/onboarding" />} className="gap-2">
          <Plus className="size-4" aria-hidden />
          {labels.create}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
