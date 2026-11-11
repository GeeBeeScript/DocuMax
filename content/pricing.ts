import { History, KeyRound, Lock, ServerCog, ShieldCheck, Users } from "lucide-react";
import { PLANS, type Plan, type PlanId } from "@/lib/billing/plans";
import type { ComparisonGroup, FaqItem, PlanCardContent, SectionIntro, TrustBadge } from "./types";

/** Pricing page copy. Caps/prices come from lib/billing/plans.ts — never duplicate numbers here. */

export const pricingHero = {
  title: "Simple plans that grow with your portfolio",
  description: "Pay for the documents you process. Every plan includes review, audit log and branded statements.",
};

function perPlan(pick: (plan: Plan) => number | null): Record<PlanId, string> {
  const fmt = (n: number | null) => (n === null ? "Custom" : n.toLocaleString("en-US"));
  return {
    free: fmt(pick(PLANS.free)),
    pro: fmt(pick(PLANS.pro)),
    business: fmt(pick(PLANS.business)),
    enterprise: fmt(pick(PLANS.enterprise)),
  };
}

export const planCards = [
  {
    planId: "free",
    tagline: "Try DocuMax on a handful of properties or jobs.",
    cta: { label: "Start for free", href: "/signup" },
    featuresHeading: "Free includes:",
    features: [
      "AI extraction with confidence scores",
      "OCR for scans and photos",
      "Review queue and audit log",
      "Branded PDF statements",
      "CSV export",
    ],
  },
  {
    planId: "pro",
    tagline: "For growing teams closing the month every month.",
    cta: { label: "Start free trial", href: "/signup?plan=pro" },
    badge: "Most popular",
    highlighted: true,
    featuresHeading: "Everything in Free, plus:",
    features: [
      "Batch statements with ZIP download",
      "Cost allocations across entities",
      "Excel export and CSV import",
      "Custom statement branding",
      "Email support",
    ],
  },
  {
    planId: "business",
    tagline: "For larger portfolios and multi-crew operations.",
    cta: { label: "Start free trial", href: "/signup?plan=business" },
    featuresHeading: "Everything in Pro, plus:",
    features: [
      "Advanced roles and permissions",
      "Custom categories",
      "Multiple statement templates",
      "Org-wide audit log export",
      "Priority support",
    ],
  },
  {
    planId: "enterprise",
    tagline: "For property groups and franchises with custom needs.",
    cta: { label: "Contact sales", href: "mailto:sales@documax.app" },
    featuresHeading: "Everything in Business, plus:",
    features: [
      "Custom document volumes",
      "SSO (on roadmap)",
      "Dedicated onboarding",
      "Custom data retention",
      "Uptime SLA",
    ],
  },
] satisfies PlanCardContent[];

export const comparison = [
  {
    title: "Documents & extraction",
    rows: [
      { label: "Documents per month", values: perPlan((p) => p.documentsPerMonth) },
      { label: "Bulk upload", values: { free: true, pro: true, business: true, enterprise: true } },
      { label: "OCR for scans & photos", values: { free: true, pro: true, business: true, enterprise: true } },
      { label: "Per-field confidence scores", values: { free: true, pro: true, business: true, enterprise: true } },
      { label: "Custom categories", values: { free: false, pro: false, business: true, enterprise: true } },
    ],
  },
  {
    title: "Review & validation",
    rows: [
      { label: "Duplicate & total checks", values: { free: true, pro: true, business: true, enterprise: true } },
      { label: "Review queue", values: { free: true, pro: true, business: true, enterprise: true } },
      { label: "Audit log", values: { free: "30 days", pro: "1 year", business: "Unlimited", enterprise: "Unlimited" } },
      { label: "Audit log export", values: { free: false, pro: false, business: true, enterprise: true } },
    ],
  },
  {
    title: "Reports & data",
    rows: [
      { label: "Branded PDF statements", values: { free: true, pro: true, business: true, enterprise: true } },
      { label: "Batch generation + ZIP", values: { free: false, pro: true, business: true, enterprise: true } },
      { label: "Cost allocations", values: { free: false, pro: true, business: true, enterprise: true } },
      { label: "CSV export", values: { free: true, pro: true, business: true, enterprise: true } },
      { label: "Excel export & CSV import", values: { free: false, pro: true, business: true, enterprise: true } },
      { label: "Statement templates", values: { free: "1", pro: "1", business: "5", enterprise: "Custom" } },
    ],
  },
  {
    title: "Team & security",
    rows: [
      { label: "Seats included", values: perPlan((p) => p.seats) },
      { label: "Roles (owner, admin, reviewer, member, viewer)", values: { free: false, pro: true, business: true, enterprise: true } },
      { label: "Organization-level data isolation", values: { free: true, pro: true, business: true, enterprise: true } },
      { label: "SSO", values: { free: false, pro: false, business: false, enterprise: "Roadmap" } },
    ],
  },
  {
    title: "Support",
    rows: [
      { label: "Help center", values: { free: true, pro: true, business: true, enterprise: true } },
      { label: "Email support", values: { free: false, pro: true, business: true, enterprise: true } },
      { label: "Priority support", values: { free: false, pro: false, business: true, enterprise: true } },
      { label: "Dedicated onboarding", values: { free: false, pro: false, business: false, enterprise: true } },
    ],
  },
] satisfies ComparisonGroup[];

/** Security facts about the architecture — only list what is actually built. */
export const security = {
  title: "Your clients' numbers stay yours",
  description: "Security is part of the architecture, not an add-on.",
  items: [
    { icon: Lock, label: "Data isolated per organization at the database level" },
    { icon: Users, label: "Role-based access for every teammate" },
    { icon: History, label: "Complete audit log of every change" },
    { icon: KeyRound, label: "Short-lived signed links for every file" },
    { icon: ShieldCheck, label: "Encrypted in transit and at rest" },
    { icon: ServerCog, label: "Automated isolation tests on every release" },
  ],
} satisfies SectionIntro & { items: TrustBadge[] };

export const pricingFaq = {
  title: "Frequently asked questions",
  items: [
    {
      question: "What counts as a document?",
      answer:
        "Any single uploaded file — one invoice, receipt or report — regardless of page count (up to 30 pages). CSV-imported records don't count toward your limit.",
    },
    {
      question: "What happens when I reach my monthly limit?",
      answer:
        "Uploads pause until the next month or until you upgrade. Everything already processed stays available, and you can still review and generate reports.",
    },
    {
      question: "Is pricing per user?",
      answer:
        "No. Plans are priced per organization and include a number of seats. Need more seats? Move up a plan or talk to us.",
    },
    {
      question: "Can I switch between monthly and yearly billing?",
      answer: "Yes, at any time from your billing settings. Yearly billing saves 20%.",
    },
    {
      question: "Does the AI decide what goes into my statements?",
      answer:
        "No. AI reads documents; your team approves the data; statement totals are calculated by tested code.",
    },
    {
      question: "Can I cancel anytime?",
      answer: "Yes. Cancel from your billing settings — your plan stays active until the end of the paid period.",
    },
  ],
} satisfies SectionIntro & { items: FaqItem[] };

export const pricingCta = {
  title: "Start free today",
  description: "25 documents a month on us. Upgrade when you're ready.",
  primary: { label: "Sign up free", href: "/signup" },
  secondary: { label: "Contact sales", href: "mailto:sales@documax.app" },
};
