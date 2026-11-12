import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A labelled figure (dashboard / statement summaries). The value is formatted by the caller. */
export function StatTile({
  label,
  value,
  hint,
  emphasis = false,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** The headline figure of a group (yellow-soft background). */
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-2xl border border-gray-200 bg-paper p-4",
        emphasis && "border-transparent bg-yellow-soft",
        className,
      )}
    >
      <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{label}</p>
      <p className="font-heading text-2xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
