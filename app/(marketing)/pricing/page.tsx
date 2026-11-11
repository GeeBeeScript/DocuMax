import type { Metadata } from "next";
import { SectionHeading } from "@/components/brand/section-heading";
import { CtaBand } from "@/components/marketing/cta-band";
import { Faq } from "@/components/marketing/faq";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { PricingTable } from "@/components/marketing/pricing-table";
import { TrustGrid } from "@/components/marketing/trust-grid";
import { Reveal } from "@/components/motion/reveal";
import { comparison, planCards, pricingCta, pricingFaq, pricingHero, security } from "@/content/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: pricingHero.description,
};

export default function PricingPage() {
  return (
    <>
      <MarketingSection spacing="md" size="wide" className="pt-12 md:pt-20">
        <Reveal className="mb-10">
          <SectionHeading
            as="h1"
            align="center"
            title={pricingHero.title}
            description={pricingHero.description}
          />
        </Reveal>
        <PricingCards cards={planCards} />
      </MarketingSection>
      <MarketingSection spacing="sm" size="wide">
        <PricingTable groups={comparison} cards={planCards} />
      </MarketingSection>
      <MarketingSection tone="ink" intro={security}>
        <TrustGrid items={security.items} />
      </MarketingSection>
      <MarketingSection intro={pricingFaq}>
        <Faq items={pricingFaq.items} />
      </MarketingSection>
      <CtaBand content={pricingCta} />
    </>
  );
}
