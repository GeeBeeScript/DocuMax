import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** App-window frame for product mockups: title bar + body. Decorative (aria-hidden by default). */
export function MockWindow({
  title,
  actions,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { title: string; actions?: ReactNode }) {
  return (
    <div
      aria-hidden
      className={cn("overflow-hidden rounded-2xl border border-gray-200 bg-paper shadow-card", className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="size-2 rounded-full bg-gray-300" />
            <span className="size-2 rounded-full bg-gray-300" />
            <span className="size-2 rounded-full bg-gray-300" />
          </span>
          <span className="font-heading text-xs font-semibold text-ink">{title}</span>
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
