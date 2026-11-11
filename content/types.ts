/**
 * Content shapes for marketing pages. Components accept these types as props; content
 * files declare data with `satisfies`. Keeping types here means content never imports components.
 */
import type { LucideIcon } from "lucide-react";
import type { PlanId } from "@/lib/billing/plans";

export interface Link {
  label: string;
  href: string;
}

export interface NavMenuItem extends Link {
  description?: string;
  icon?: LucideIcon;
}

export interface NavMenuGroup {
  label: string;
  columns: { heading: string; items: NavMenuItem[] }[];
  featured?: { eyebrow: string; title: string; description: string; href: string };
}

export type NavEntry = ({ kind: "link" } & Link) | ({ kind: "menu" } & NavMenuGroup);

export interface HeroContent {
  badge?: string;
  title: { before: string; marked: string; after?: string };
  description: string;
  cta: { label: string; emailPlaceholder: string; microcopy?: string };
  secondary?: Link;
}

export const SHOWCASE_KINDS = ["upload", "extract", "review", "report"] as const;
export type ShowcaseKind = (typeof SHOWCASE_KINDS)[number];

export interface UseCaseTab {
  id: string;
  label: string;
  heading: string;
  bullets: string[];
  link: Link;
  visual: ShowcaseKind;
}

export interface AlternatingFeatureContent {
  eyebrow?: string;
  title: string;
  description: string;
  bullets?: string[];
  link?: Link;
  visual: ShowcaseKind;
}

export interface Stat {
  value: string;
  label: string;
}

export interface TestimonialContent {
  quote: string;
  name: string;
  role: string;
  company: string;
  link?: Link;
}

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
}

export interface PersonaCardContent {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  color: "yellow" | "blue" | "pink" | "green";
}

export interface ResourceLink {
  title: string;
  description: string;
  href: string;
}

export interface CtaContent {
  title: string;
  description?: string;
  primary: Link;
  secondary?: Link;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FooterColumn {
  heading: string;
  links: Link[];
}

export interface TrustBadge {
  icon: LucideIcon;
  label: string;
}

export interface WorkflowStep {
  title: string;
  description: string;
}

export interface SectionIntro {
  eyebrow?: string;
  title: string;
  description?: string;
}

export interface IndustryContent {
  slug: string;
  metadata: { title: string; description: string };
  hero: HeroContent;
  problems: SectionIntro & { items: Feature[] };
  workflow: SectionIntro & { steps: WorkflowStep[] };
  useCases: SectionIntro & { tabs: UseCaseTab[] };
  stats: Stat[];
  testimonial: TestimonialContent;
  faq: SectionIntro & { items: FaqItem[] };
  cta: CtaContent;
}

export interface PlanCardContent {
  planId: PlanId;
  tagline: string;
  cta: Link;
  badge?: string;
  highlighted?: boolean;
  featuresHeading: string;
  features: string[];
}

export type ComparisonValue = boolean | string;

export interface ComparisonGroup {
  title: string;
  rows: { label: string; values: Record<PlanId, ComparisonValue> }[];
}
