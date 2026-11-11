import type { IndustryContent } from "@/content/types";
import { CtaBand } from "./cta-band";
import { Faq } from "./faq";
import { FeatureGrid } from "./feature-grid";
import { Hero } from "./hero";
import { MarketingSection } from "./marketing-section";
import { StatsRow } from "./stats-row";
import { Testimonial } from "./testimonial";
import { UseCaseTabs } from "./use-case-tabs";
import { ShowcaseVisual } from "./visuals/showcase-visual";
import { WorkflowSteps } from "./workflow-steps";

/**
 * Persona landing page template. /property-managers and /contractors are the same component
 * with different content objects (content/industries.ts).
 */
export function IndustryPage({ content }: { content: IndustryContent }) {
  return (
    <>
      <Hero content={content.hero} visual={<ShowcaseVisual kind="report" className="min-h-96" />} />
      <MarketingSection tone="canvas" intro={content.problems}>
        <FeatureGrid items={content.problems.items} columns={4} />
      </MarketingSection>
      <MarketingSection intro={content.workflow} spacing="lg">
        <WorkflowSteps steps={content.workflow.steps} />
      </MarketingSection>
      <MarketingSection tone="canvas" intro={content.useCases} size="wide">
        <UseCaseTabs tabs={content.useCases.tabs} />
      </MarketingSection>
      <MarketingSection tone="ink">
        <StatsRow stats={content.stats} />
      </MarketingSection>
      <MarketingSection spacing="lg">
        <Testimonial content={content.testimonial} />
      </MarketingSection>
      <MarketingSection tone="canvas" intro={content.faq}>
        <Faq items={content.faq.items} />
      </MarketingSection>
      <CtaBand content={content.cta} />
    </>
  );
}
