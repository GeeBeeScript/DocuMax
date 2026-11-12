import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A keyboard key hint, e.g. <Kbd>A</Kbd>. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-gray-300 bg-gray-50 px-1 font-sans text-[0.6875rem] font-semibold text-ink-soft",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
