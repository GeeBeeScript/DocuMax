import type { ReactNode } from "react";
import { Container, Section, type SectionProps } from "@/components/brand/section";
import { SectionHeading } from "@/components/brand/section-heading";
import { Reveal } from "@/components/motion/reveal";
import type { SectionIntro } from "@/content/types";
import { cn } from "@/lib/utils";

export type MarketingSectionProps = Omit<SectionProps, "title" | "children"> & {
  intro?: SectionIntro;
  align?: "left" | "center";
  size?: "default" | "wide" | "narrow";
  children: ReactNode;
};

/**
 * The standard marketing section: background tone + vertical rhythm + container + optional
 * heading block. Every page section should use this rather than re-assembling the pieces.
 */
export function MarketingSection({
  intro,
  align = "center",
  size = "default",
  children,
  className,
  ...sectionProps
}: MarketingSectionProps) {
  return (
    <Section className={cn("scroll-mt-20", className)} {...sectionProps}>
      <Container size={size}>
        {intro && (
          <Reveal className="mb-12 md:mb-16">
            <SectionHeading
              align={align}
              eyebrow={intro.eyebrow}
              title={intro.title}
              description={intro.description}
            />
          </Reveal>
        )}
        {children}
      </Container>
    </Section>
  );
}
