import {
  CalendarClock,
  Copy,
  FileQuestion,
  Receipt,
  Scale,
  Split,
  TrendingDown,
  Truck,
} from "lucide-react";
import type { IndustryContent } from "./types";

/**
 * Persona landing pages. Both render through the same <IndustryPage> template —
 * add a persona by adding an object here, not new components.
 */

export const propertyManagers = {
  slug: "property-managers",
  metadata: {
    title: "For property managers",
    description:
      "Turn maintenance invoices, utility bills and receipts into monthly owner statements per property — checked, reviewed and branded.",
  },
  hero: {
    badge: "For property managers",
    title: { before: "Owner statements for every property,", marked: "without the retyping" },
    description:
      "Upload a month of supplier invoices across your portfolio. DocuMax extracts the costs, matches them to properties, flags what needs a second look and produces a branded statement for each owner.",
    cta: {
      label: "Start free",
      emailPlaceholder: "Enter your work email",
      microcopy: "25 documents a month free. No credit card.",
    },
    secondary: { label: "See pricing", href: "/pricing" },
  },
  problems: {
    eyebrow: "Sound familiar?",
    title: "Month-end shouldn't take a week",
    items: [
      { icon: Receipt, title: "Paper everywhere", description: "Invoices arrive by email, mail and text — in every format imaginable." },
      { icon: Split, title: "Shared costs", description: "One landscaping bill covers three buildings. Splitting it by hand invites mistakes." },
      { icon: Copy, title: "Double-billing", description: "The same invoice sent twice slips through and an owner gets charged twice." },
      { icon: CalendarClock, title: "Late statements", description: "Owners wait while your team keys in numbers instead of managing properties." },
    ],
  },
  workflow: {
    eyebrow: "Your new month-end",
    title: "Four steps from inbox to owner",
    steps: [
      { title: "Upload the month", description: "Drop every invoice and receipt in one go — PDFs, scans, photos." },
      { title: "Match to properties", description: "DocuMax suggests the property from addresses on the document." },
      { title: "Review the flags", description: "Duplicates, missing tax and mismatched totals wait in a queue." },
      { title: "Send statements", description: "Batch-generate branded PDFs for every owner and download a ZIP." },
    ],
  },
  useCases: {
    eyebrow: "See it in action",
    title: "Built around the way you close the month",
    tabs: [
      {
        id: "upload",
        label: "Collect",
        heading: "All your vendors, one inbox-free upload",
        bullets: ["Bulk upload by property or all at once", "Phone photos of receipts welcome", "Live status per file"],
        link: { label: "Start free", href: "/signup" },
        visual: "upload",
      },
      {
        id: "extract",
        label: "Extract",
        heading: "Costs categorized the way owners expect",
        bullets: ["Repairs, utilities, landscaping, cleaning and more", "Tax and totals cross-checked", "Confidence on every field"],
        link: { label: "Start free", href: "/signup" },
        visual: "extract",
      },
      {
        id: "review",
        label: "Review",
        heading: "Catch the expensive mistakes",
        bullets: ["Duplicate invoices flagged automatically", "Correct a field in seconds", "Full audit trail per property"],
        link: { label: "Start free", href: "/signup" },
        visual: "review",
      },
      {
        id: "report",
        label: "Statement",
        heading: "A statement per property, per month",
        bullets: ["Your logo and colors", "Category breakdown and line detail", "Batch every property into one ZIP"],
        link: { label: "Start free", href: "/signup" },
        visual: "report",
      },
    ],
  },
  stats: [
    { value: "1 click", label: "to generate statements for every property in a month" },
    { value: "To the cent", label: "shared costs split across properties" },
    { value: "Per owner", label: "branded PDF with your logo and page numbers" },
  ],
  // PLACEHOLDER: illustrative testimonial — replace before launch.
  testimonial: {
    quote:
      "We manage 140 doors. Shared-cost splits were our biggest source of owner complaints — now they're calculated the same way every time.",
    name: "Marcus Bell",
    role: "Portfolio Manager",
    company: "Oakline PM",
  },
  faq: {
    title: "Questions from property managers",
    items: [
      {
        question: "Can one invoice be split across several properties?",
        answer:
          "Yes. Split any invoice or line item by percentage or fixed amount. DocuMax calculates the split in code so it always adds up to the cent.",
      },
      {
        question: "Does the AI calculate the statement totals?",
        answer:
          "No. AI only reads values from documents. Every total, allocation and statement figure is calculated by tested code from approved records.",
      },
      {
        question: "Can owners see their statements?",
        answer:
          "Statements are PDFs you send however you like today. An owner portal is on the roadmap.",
      },
      {
        question: "What if a document is handwritten or a blurry photo?",
        answer:
          "DocuMax uses OCR for scans and photos. Fields it isn't sure about get low confidence scores and go to your review queue.",
      },
    ],
  },
  cta: {
    title: "Send this month's statements faster",
    description: "Try DocuMax free on your next batch of invoices.",
    primary: { label: "Start free", href: "/signup" },
    secondary: { label: "See pricing", href: "/pricing" },
  },
} satisfies IndustryContent;

export const contractors = {
  slug: "contractors",
  metadata: {
    title: "For home-service contractors",
    description:
      "Capture supplier receipts and invoices, track real costs per job, and produce clean job cost statements and quotes.",
  },
  hero: {
    badge: "For home-service contractors",
    title: { before: "Know what every job", marked: "really cost" },
    description:
      "Snap supplier receipts from the truck, upload invoices from the office. DocuMax extracts materials and labor, assigns them to jobs and builds job cost statements you can trust when quoting the next one.",
    cta: {
      label: "Start free",
      emailPlaceholder: "Enter your work email",
      microcopy: "25 documents a month free. No credit card.",
    },
    secondary: { label: "See pricing", href: "/pricing" },
  },
  problems: {
    eyebrow: "Sound familiar?",
    title: "Profit leaks hide in the receipts",
    items: [
      { icon: Truck, title: "Receipts in the truck", description: "Crumpled supply-house receipts never make it back to the office." },
      { icon: FileQuestion, title: "Which job was that for?", description: "Materials get bought for three jobs on one ticket." },
      { icon: TrendingDown, title: "Quotes based on guesses", description: "Without real job costs, the next quote is a coin flip." },
      { icon: Scale, title: "Bookkeeping backlog", description: "Your bookkeeper chases you for paperwork every month." },
    ],
  },
  workflow: {
    eyebrow: "Your new paperwork routine",
    title: "From supply house to job report",
    steps: [
      { title: "Snap or upload", description: "Photos from the job site, PDFs from email — all in one place." },
      { title: "Assign to jobs", description: "DocuMax suggests the job from references on the receipt." },
      { title: "Check the flags", description: "Missing tax, duplicates and odd totals are queued for review." },
      { title: "Report and quote", description: "Job cost statements and exports for your bookkeeper in one click." },
    ],
  },
  useCases: {
    eyebrow: "See it in action",
    title: "Job costing without the spreadsheet",
    tabs: [
      {
        id: "upload",
        label: "Capture",
        heading: "Every receipt, from anywhere",
        bullets: ["Upload photos straight from your phone", "Bulk-drop supplier invoices", "Live processing status"],
        link: { label: "Start free", href: "/signup" },
        visual: "upload",
      },
      {
        id: "extract",
        label: "Extract",
        heading: "Materials and labor, line by line",
        bullets: ["Line items with quantities and prices", "Categories like materials, labor and rentals", "Confidence on every field"],
        link: { label: "Start free", href: "/signup" },
        visual: "extract",
      },
      {
        id: "review",
        label: "Review",
        heading: "Nothing slips through",
        bullets: ["Duplicate receipts flagged", "Totals cross-checked", "Every correction logged"],
        link: { label: "Start free", href: "/signup" },
        visual: "review",
      },
      {
        id: "report",
        label: "Job report",
        heading: "Job cost statements that win the next bid",
        bullets: ["Costs per job and category", "Branded PDF or Excel export", "Batch reports for all active jobs"],
        link: { label: "Start free", href: "/signup" },
        visual: "report",
      },
    ],
  },
  stats: [
    { value: "Per job", label: "costs rolled up by category and supplier" },
    { value: "Line items", label: "materials and labor extracted, not just totals" },
    { value: "CSV & Excel", label: "exports your bookkeeper can use as-is" },
  ],
  // PLACEHOLDER: illustrative testimonial — replace before launch.
  testimonial: {
    quote:
      "I used to guess material costs on bids. Now I pull up the last three similar jobs and quote from real numbers.",
    name: "Rosa Delgado",
    role: "Owner",
    company: "Summit Trades Remodeling",
  },
  faq: {
    title: "Questions from contractors",
    items: [
      {
        question: "Can I upload receipts from my phone?",
        answer: "Yes. Phone photos and scans are supported; DocuMax uses OCR to read them.",
      },
      {
        question: "One receipt covers materials for several jobs — can I split it?",
        answer: "Yes. Split a receipt or individual line items across jobs by percentage or amount.",
      },
      {
        question: "Does it connect to my accounting software?",
        answer:
          "Today you can export CSV and Excel files your bookkeeper can import. Direct integrations are on the roadmap.",
      },
      {
        question: "Can I create quotes?",
        answer:
          "DocuMax includes a branded quote template built from your real job costs. Full quote workflows are on the roadmap.",
      },
    ],
  },
  cta: {
    title: "Stop losing receipts — and margin",
    description: "Try DocuMax free on this month's receipts.",
    primary: { label: "Start free", href: "/signup" },
    secondary: { label: "See pricing", href: "/pricing" },
  },
} satisfies IndustryContent;
