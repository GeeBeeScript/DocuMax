import { Container } from "@/components/brand/section";
import { PillButton } from "@/components/brand/pill-button";
import { StickyNote } from "@/components/brand/sticky-note";
import { Reveal } from "@/components/motion/reveal";
import type { CtaContent } from "@/content/types";

/** Big yellow closing call-to-action band with decorative sticky notes. */
export function CtaBand({ content }: { content: CtaContent }) {
  const { title, description, primary, secondary } = content;
  return (
    <section className="relative overflow-hidden bg-yellow py-20 md:py-28">
      <StickyNote color="paper" tilt="left" aria-hidden className="absolute top-10 -left-6 hidden h-28 w-28 lg:block" />
      <StickyNote color="pink" tilt="right" aria-hidden className="absolute -right-4 bottom-10 hidden h-24 w-24 lg:block" />
      <Container size="narrow">
        <Reveal className="flex flex-col items-center gap-6 text-center">
          <h2 className="text-display-md font-extrabold text-balance md:text-display-lg">{title}</h2>
          {description && <p className="text-lg text-ink-soft">{description}</p>}
          <div className="flex flex-wrap justify-center gap-3">
            <PillButton href={primary.href} size="lg">
              {primary.label}
            </PillButton>
            {secondary && (
              <PillButton href={secondary.href} size="lg" variant="outline">
                {secondary.label}
              </PillButton>
            )}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
