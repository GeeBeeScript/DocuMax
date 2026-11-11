import type { ReactNode } from "react";
import { Container } from "@/components/brand/section";
import { PillButton } from "@/components/brand/pill-button";
import { YellowMarker } from "@/components/brand/yellow-marker";
import { Reveal } from "@/components/motion/reveal";
import type { HeroContent } from "@/content/types";
import { cn } from "@/lib/utils";
import { EmailCtaForm } from "./email-cta-form";

export type HeroProps = {
  content: HeroContent;
  /** Product visual rendered below the copy (e.g. <HeroBoard />). */
  visual?: ReactNode;
  className?: string;
};

/** Centered hero: badge, display headline with marker, lead, email CTA, microcopy, then a board visual. */
export function Hero({ content, visual, className }: HeroProps) {
  const { badge, title, description, cta, secondary } = content;
  return (
    <section className={cn("overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24", className)}>
      <Container className="flex flex-col items-center text-center">
        {/* No Reveal here: the headline is the LCP element and must paint without JS. */}
        <div className="flex flex-col items-center gap-6">
          {badge && (
            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-paper px-3 py-1 text-sm font-semibold text-ink-soft shadow-card">
              <span aria-hidden className="size-2 rounded-full bg-yellow" />
              {badge}
            </span>
          )}
          <h1 className="max-w-4xl text-display-md font-extrabold text-balance sm:text-display-lg lg:text-display-xl">
            {title.before} <YellowMarker>{title.marked}</YellowMarker>
            {title.after && <> {title.after}</>}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground md:text-xl">{description}</p>
        </div>
        <Reveal delay={0.1} className="mt-8 flex w-full flex-col items-center gap-3">
          <EmailCtaForm label={cta.label} placeholder={cta.emailPlaceholder} />
          {cta.microcopy && <p className="text-sm text-gray-500">{cta.microcopy}</p>}
          {secondary && (
            <PillButton href={secondary.href} variant="ghost" size="sm">
              {secondary.label} →
            </PillButton>
          )}
        </Reveal>
      </Container>
      {visual && (
        <Container size="wide" className="mt-12 md:mt-16">
          {visual}
        </Container>
      )}
    </section>
  );
}
