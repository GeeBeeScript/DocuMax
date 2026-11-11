import {
  Building2,
  Calculator,
  FileSpreadsheet,
  FileStack,
  HardHat,
  History,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type {
  AlternatingFeatureContent,
  CtaContent,
  Feature,
  HeroContent,
  PersonaCardContent,
  ResourceLink,
  SectionIntro,
  Stat,
  TestimonialContent,
  UseCaseTab,
} from "./types";

/** Home page copy. Section order mirrors docs/DESIGN_SYSTEM.md → page mapping. */

export const homeHero = {
  badge: "For property managers & contractors",
  title: { before: "Messy paperwork in.", marked: "Polished statements", after: "out." },
  description:
    "Drop in supplier invoices and receipts. DocuMax reads them, checks every number, routes doubts to your team, and turns approved costs into branded monthly statements per property or job.",
  cta: {
    label: "Sign up free",
    emailPlaceholder: "Enter your work email",
    microcopy: "Free for 25 documents a month. No credit card required.",
  },
} satisfies HeroContent;

// PLACEHOLDER: fictional company names — replace with real customers (with permission) before launch.
export const logoStrip = {
  heading: "Built for teams that run on paperwork",
  names: [
    "Northwind Properties",
    "Harbor & Pine",
    "Keystone Homes",
    "BlueRidge Services",
    "Oakline PM",
    "Summit Trades",
  ],
};

export const useCases = {
  eyebrow: "How it works",
  title: "From shoebox to statement in four steps",
  tabs: [
    {
      id: "upload",
      label: "Upload",
      heading: "Drop in everything, all at once",
      bullets: [
        "Bulk-upload PDFs, scans and phone photos",
        "Assign documents to a property or job — or let DocuMax suggest one",
        "Watch each file's status update live",
      ],
      link: { label: "Start uploading", href: "/signup" },
      visual: "upload",
    },
    {
      id: "extract",
      label: "Extract",
      heading: "Every field read, scored and structured",
      bullets: [
        "Text layer first, OCR for scans and photos",
        "Supplier, dates, line items, tax and totals in a fixed format",
        "A confidence score on every single field",
      ],
      link: { label: "See the data model", href: "/#features" },
      visual: "extract",
    },
    {
      id: "review",
      label: "Review",
      heading: "Your team decides — DocuMax flags",
      bullets: [
        "Duplicates, missing fields and totals that don't add up",
        "Low-confidence items queue up for a human",
        "Approve, reject or correct with keyboard shortcuts",
      ],
      link: { label: "Explore review", href: "/#features" },
      visual: "review",
    },
    {
      id: "report",
      label: "Report",
      heading: "Statements your clients actually read",
      bullets: [
        "Branded multi-page PDFs with your logo and page numbers",
        "Tables that flow cleanly across pages",
        "Generate a whole month in one batch, download as ZIP",
      ],
      link: { label: "See a sample statement", href: "/#features" },
      visual: "report",
    },
  ],
} satisfies SectionIntro & { tabs: UseCaseTab[] };

/** Alternating image/text blocks under the showcase (Miro home pattern). */
export const highlights = {
  eyebrow: "Why teams switch",
  title: "Trust the numbers without retyping them",
  items: [
    {
      eyebrow: "Checked, not guessed",
      title: "AI reads. Code does the math.",
      description:
        "DocuMax extracts every field into a fixed format, then recalculates totals and tax itself. If the numbers on the page don't add up, you'll know before anyone else does.",
      bullets: [
        "Line items re-summed and compared with the invoice total",
        "Tax checked against the subtotal, to the cent",
        "Low-confidence fields highlighted for a second look",
      ],
      visual: "extract",
    },
    {
      eyebrow: "Human in the loop",
      title: "Review only what needs a human",
      description:
        "Clean documents flow straight through. Duplicates, missing dates and suspicious totals land in a focused queue your team clears in minutes.",
      bullets: ["Every issue explained in plain language", "Corrections and approvals logged with a reason"],
      link: { label: "Explore review", href: "/#how-it-works" },
      visual: "review",
    },
    {
      eyebrow: "Client-ready output",
      title: "Statements that look like you made them by hand",
      description:
        "Your logo, your colors, page numbers and tables that break cleanly across pages — for one property or job, or the whole month in a batch.",
      link: { label: "See pricing", href: "/pricing" },
      visual: "report",
    },
  ],
} satisfies SectionIntro & { items: AlternatingFeatureContent[] };

/** Product capability facts — not customer metrics. */
export const stats = [
  { value: "< 60 s", label: "typical time from upload to checked data" },
  { value: "100%", label: "of figures calculated by code, never guessed by AI" },
  { value: "Audited", label: "every upload, correction and approval — who and when" },
] satisfies Stat[];

// PLACEHOLDER: illustrative testimonial — replace with a real customer quote before launch.
export const homeTestimonial = {
  quote:
    "Month-end used to mean two days of retyping invoices into spreadsheets. Now we review the flagged ones over coffee and send owner statements the same morning.",
  name: "Dana Whitfield",
  role: "Operations Lead",
  company: "Harbor & Pine Property Management",
} satisfies TestimonialContent;

export const features = {
  eyebrow: "Everything in one place",
  title: "The whole back office, minus the typing",
  items: [
    {
      icon: Sparkles,
      title: "AI extraction with confidence",
      description: "A fixed schema for supplier, dates, tax, totals and line items — each field scored.",
    },
    {
      icon: ListChecks,
      title: "Validation & review queue",
      description: "Duplicates, missing fields and mismatched totals are caught before they reach a report.",
    },
    {
      icon: Calculator,
      title: "Allocations that add up",
      description: "Split costs across properties or jobs by percent or amount — always to the cent.",
    },
    {
      icon: FileStack,
      title: "Branded PDF statements",
      description: "Logo, header, footer and page numbers. Batch a month and download a ZIP.",
    },
    {
      icon: FileSpreadsheet,
      title: "CSV & Excel",
      description: "Export anything to your accountant, or import historical records from CSV.",
    },
    {
      icon: ShieldCheck,
      title: "Secure by design",
      description:
        "Each organization's data is isolated at the database level, with roles for every teammate.",
    },
  ],
} satisfies SectionIntro & { items: Feature[] };

export const personas = {
  eyebrow: "Made for your trade",
  title: "One workflow, two industries",
  items: [
    {
      icon: Building2,
      eyebrow: "Property managers",
      title: "Owner statements per property, every month",
      description: "Turn maintenance invoices and utility bills into clean statements owners trust.",
      href: "/property-managers",
      color: "yellow",
    },
    {
      icon: HardHat,
      eyebrow: "Home-service contractors",
      title: "Know what every job really cost",
      description: "Capture supplier receipts on the go and roll them into job cost statements and quotes.",
      href: "/contractors",
      color: "blue",
    },
  ],
} satisfies SectionIntro & { items: PersonaCardContent[] };

export const auditCallout = {
  icon: History,
  eyebrow: "Accountability built in",
  title: "Every number has a paper trail",
  description:
    "Who uploaded it, what the AI read, who corrected it and when — every change is logged so statements stand up to any question.",
};

export const resources = {
  title: "Need help getting started?",
  items: [
    { title: "Pricing", description: "Plans for every portfolio size", href: "/pricing" },
    { title: "Property managers", description: "Statements per property", href: "/property-managers" },
    { title: "Contractors", description: "Costs per job", href: "/contractors" },
    { title: "Help center", description: "Guides and answers", href: "#" },
  ],
} satisfies { title: string; items: ResourceLink[] };

export const homeCta = {
  title: "Close the month before lunch",
  description: "Start free with 25 documents a month. Upgrade when your portfolio grows.",
  primary: { label: "Sign up free", href: "/signup" },
  secondary: { label: "See pricing", href: "/pricing" },
} satisfies CtaContent;
