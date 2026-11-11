import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HoverLift } from "@/components/motion/hover-lift";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import type { Feature } from "@/content/types";
import { cn } from "@/lib/utils";

export function FeatureCard({ feature, className }: { feature: Feature; className?: string }) {
  const { icon: Icon, title, description, href } = feature;
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-4 rounded-3xl border border-gray-200 bg-paper p-6 shadow-card",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-yellow text-ink">
        <Icon className="size-6" />
      </span>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
      {href && (
        <Link
          href={href}
          className="mt-auto inline-flex items-center gap-1 font-semibold text-ink hover:underline"
        >
          Learn more <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

/** Responsive grid of feature cards (1 → 2 → 3 columns) with staggered reveal and hover lift. */
export function FeatureGrid({
  items,
  columns = 3,
  className,
}: {
  items: readonly Feature[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <Stagger
      as="ul"
      className={cn(
        "grid gap-6 sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
        columns === 4 && "lg:grid-cols-4",
        className,
      )}
    >
      {items.map((f) => (
        <StaggerItem as="li" key={f.title} className="rounded-3xl">
          <HoverLift className="rounded-3xl">
            <FeatureCard feature={f} />
          </HoverLift>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
