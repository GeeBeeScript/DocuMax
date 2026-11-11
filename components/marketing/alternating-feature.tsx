import { PillButton } from "@/components/brand/pill-button";
import { Reveal } from "@/components/motion/reveal";
import type { AlternatingFeatureContent } from "@/content/types";
import { cn } from "@/lib/utils";
import { CheckList } from "./check-list";
import { ShowcaseVisual } from "./visuals/showcase-visual";

/**
 * Stack of feature rows that alternate copy and board visual left/right (visual first on
 * odd rows from `lg` up). On small screens copy always comes first.
 */
export function AlternatingFeature({
  items,
  className,
}: {
  items: readonly AlternatingFeatureContent[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-col gap-20 md:gap-28", className)}>
      {items.map((item, i) => (
        <li key={item.title} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal className={cn("flex min-w-0 flex-col items-start gap-5", i % 2 === 1 && "lg:order-2")}>
            {item.eyebrow && (
              <p className="font-heading text-sm font-semibold tracking-wide text-ink-soft uppercase">
                {item.eyebrow}
              </p>
            )}
            <h3 className="text-display-md font-bold text-balance">{item.title}</h3>
            <p className="text-lg text-pretty text-muted-foreground">{item.description}</p>
            {item.bullets && <CheckList items={item.bullets} />}
            {item.link && (
              <PillButton href={item.link.href} variant="outline">
                {item.link.label}
              </PillButton>
            )}
          </Reveal>
          <Reveal className={cn("min-w-0", i % 2 === 1 && "lg:order-1")}>
            <ShowcaseVisual kind={item.visual} />
          </Reveal>
        </li>
      ))}
    </ul>
  );
}
