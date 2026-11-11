import {
  BookOpen,
  Building2,
  Calculator,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HardHat,
  History,
  LifeBuoy,
  ListChecks,
  Newspaper,
  Receipt,
  ScanText,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import type { Link, NavEntry } from "./types";

export const mainNav = [
  {
    kind: "menu",
    label: "Product",
    columns: [
      {
        heading: "How it works",
        items: [
          { label: "Upload & OCR", href: "/#how-it-works", icon: Upload, description: "Bulk-drop PDFs and photos" },
          { label: "AI extraction", href: "/#how-it-works", icon: Sparkles, description: "Fields with confidence scores" },
          { label: "Review queue", href: "/#how-it-works", icon: ListChecks, description: "Approve, reject or correct" },
          { label: "Statements & reports", href: "/#how-it-works", icon: FileText, description: "Branded multi-page PDFs" },
        ],
      },
      {
        heading: "Platform",
        items: [
          { label: "Exports & imports", href: "/#features", icon: FileSpreadsheet, description: "CSV and Excel in and out" },
          { label: "Audit log", href: "/#features", icon: History, description: "Every change, every person" },
          { label: "Security", href: "/#features", icon: ShieldCheck, description: "Data isolated per organization" },
        ],
      },
    ],
    featured: {
      eyebrow: "New",
      title: "Batch statements",
      description: "Generate a month of statements for every property or job in one click.",
      href: "/#how-it-works",
    },
  },
  {
    kind: "menu",
    label: "Solutions",
    columns: [
      {
        heading: "By industry",
        items: [
          { label: "Property managers", href: "/property-managers", icon: Building2, description: "Owner statements per property" },
          { label: "Home-service contractors", href: "/contractors", icon: HardHat, description: "Job costing and quotes" },
        ],
      },
      {
        heading: "By use case",
        items: [
          { label: "Monthly cost statements", href: "/property-managers", icon: FileText },
          { label: "Job cost tracking", href: "/contractors", icon: Calculator },
          { label: "Receipt capture", href: "/#how-it-works", icon: Receipt },
          { label: "Invoice data entry", href: "/#how-it-works", icon: ScanText },
        ],
      },
    ],
  },
  {
    kind: "menu",
    label: "Resources",
    columns: [
      {
        heading: "Learn",
        items: [
          { label: "Help center", href: "#", icon: LifeBuoy, description: "Guides and answers" },
          { label: "Getting started", href: "#", icon: GraduationCap, description: "Set up in 10 minutes" },
          { label: "Blog", href: "#", icon: Newspaper, description: "Bookkeeping tips and product news" },
          { label: "Statement templates", href: "#", icon: BookOpen, description: "Examples you can reuse" },
        ],
      },
    ],
  },
  { kind: "link", label: "Pricing", href: "/pricing" },
] satisfies NavEntry[];

export const authNav = {
  login: { label: "Log in", href: "/login" },
  contact: { label: "Contact sales", href: "mailto:sales@documax.app" },
  signup: { label: "Sign up free", href: "/signup" },
} satisfies Record<string, Link>;

export const announcement = {
  text: "Batch statements are here — a month of owner statements in one click.",
  link: { label: "See how", href: "/#how-it-works" },
};
