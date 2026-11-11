import { Stagger, StaggerItem } from "@/components/motion/stagger";
import type { TrustBadge } from "@/content/types";
import { cn } from "@/lib/utils";

/** Grid of security/trust facts with icons. */
export function TrustGrid({ items, className }: { items: readonly TrustBadge[]; className?: string }) {
  return (
    <Stagger as="ul" className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map(({ icon: Icon, label }) => (
        <StaggerItem
          as="li"
          key={label}
          className="flex items-center gap-4 rounded-2xl border border-paper/15 bg-paper/5 p-5"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-yellow text-ink">
            <Icon className="size-5" />
          </span>
          <span className="font-medium">{label}</span>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
