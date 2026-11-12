import { cents, formatCents } from "@/lib/calc/money";
import { cn } from "@/lib/utils";

/** An amount in cents, formatted for its currency (tabular figures). Null → em dash. Formatting only — no math. */
export function Money({
  value,
  currency,
  className,
}: {
  value: number | null;
  currency: string | null;
  className?: string;
}) {
  if (value == null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return (
    <span className={cn("tabular-nums", className)}>{formatCents(cents(value), currency ?? "USD")}</span>
  );
}
