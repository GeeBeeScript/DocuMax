"use client";

import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "./initials";

/** Avatar button with the user's name/email and log out (a Server Action passed in by the layout). */
export function UserMenu({
  name,
  email,
  onLogOut,
  labels,
}: {
  name: string | null;
  email: string;
  onLogOut: () => Promise<void>;
  labels: { label: string; logOut: string };
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={labels.label}
        className="flex size-10 items-center justify-center rounded-full bg-note-blue font-heading text-sm font-bold text-ink hover:ring-2 hover:ring-gray-200 focus-visible:ring-3 focus-visible:ring-ink/30 focus-visible:outline-none"
      >
        {initials(name, email)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            {name && <span className="font-semibold text-ink">{name}</span>}
            <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void onLogOut()} className="gap-2">
          <LogOut className="size-4" aria-hidden />
          {labels.logOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
