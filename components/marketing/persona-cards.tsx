import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HoverLift } from "@/components/motion/hover-lift";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import type { PersonaCardContent } from "@/content/types";
import { cn } from "@/lib/utils";

const bg = {
  yellow: "bg-note-yellow",
  blue: "bg-note-blue",
  pink: "bg-note-pink",
  green: "bg-note-green",
} as const;

/** Large sticky-note style cards linking to persona pages. */
export function PersonaCards({ items, className }: { items: readonly PersonaCardContent[]; className?: string }) {
  return (
    <Stagger as="ul" className={cn("grid gap-6 md:grid-cols-2", className)}>
      {items.map(({ icon: Icon, ...p }) => (
        <StaggerItem as="li" key={p.href} className="rounded-3xl">
          <HoverLift className="rounded-3xl">
            <Link
              href={p.href}
              className={cn(
                "group flex h-full flex-col gap-4 rounded-3xl p-8 outline-none focus-visible:ring-3 focus-visible:ring-ink/30 md:p-10",
                bg[p.color],
              )}
            >
              <span className="flex items-center gap-2 font-heading text-sm font-semibold text-ink-soft">
                <Icon className="size-5 text-ink" /> {p.eyebrow}
              </span>
              <span className="font-heading text-3xl font-bold text-balance text-ink">{p.title}</span>
              <span className="text-ink-soft">{p.description}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-4 font-semibold text-ink">
                Explore
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </HoverLift>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
