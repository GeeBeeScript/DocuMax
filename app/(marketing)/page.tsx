import { AlternatingFeature } from "@/components/marketing/alternating-feature";
import { CalloutBand } from "@/components/marketing/callout-band";
import { CtaBand } from "@/components/marketing/cta-band";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { Hero } from "@/components/marketing/hero";
import { HeroBoard } from "@/components/marketing/visuals/hero-board";
import { LogoStrip } from "@/components/marketing/logo-strip";
import { MarketingSection } from "@/components/marketing/marketing-section";
import { PersonaCards } from "@/components/marketing/persona-cards";
import { ResourceLinks } from "@/components/marketing/resource-links";
import { StatsRow } from "@/components/marketing/stats-row";
import { Testimonial } from "@/components/marketing/testimonial";
import { UseCaseTabs } from "@/components/marketing/use-case-tabs";
import {
  auditCallout,
  features,
  highlights,
  homeCta,
  homeHero,
  homeTestimonial,
  logoStrip,
  personas,
  resources,
  stats,
  useCases,
} from "@/content/marketing";

export default function HomePage() {
  return (
    <>
      <Hero content={homeHero} visual={<HeroBoard />} />
      <LogoStrip heading={logoStrip.heading} names={logoStrip.names} />
      <MarketingSection id="how-it-works" tone="canvas" intro={useCases} size="wide">
        <UseCaseTabs tabs={useCases.tabs} />
      </MarketingSection>
      <MarketingSection id="why-documax" intro={highlights}>
        <AlternatingFeature items={highlights.items} />
      </MarketingSection>
      <MarketingSection tone="ink" spacing="md">
        <StatsRow stats={stats} />
      </MarketingSection>
      <MarketingSection spacing="lg">
        <Testimonial content={homeTestimonial} />
      </MarketingSection>
      <MarketingSection id="features" tone="canvas" intro={features}>
        <FeatureGrid items={features.items} />
      </MarketingSection>
      <MarketingSection intro={personas}>
        <PersonaCards items={personas.items} />
      </MarketingSection>
      <MarketingSection tone="board" spacing="lg">
        <CalloutBand {...auditCallout} />
      </MarketingSection>
      <MarketingSection spacing="md">
        <ResourceLinks title={resources.title} items={resources.items} />
      </MarketingSection>
      <CtaBand content={homeCta} />
    </>
  );
}
