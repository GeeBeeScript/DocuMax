import { Stagger, StaggerItem } from "@/components/motion/stagger";
import type { Stat } from "@/content/types";
import { cn } from "@/lib/utils";

/** Row of large figures with captions. */
export function StatsRow({ stats, className }: { stats: readonly Stat[]; className?: string }) {
  return (
    <Stagger as="ul" className={cn("grid gap-8 text-center sm:grid-cols-3", className)}>
      {stats.map((s) => (
        <StaggerItem as="li" key={s.label} className="flex flex-col items-center gap-2">
          <span className="font-heading text-5xl font-extrabold tracking-tight md:text-6xl">{s.value}</span>
          <span className="max-w-56 text-base text-pretty opacity-80">{s.label}</span>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
