import { History, Lock, ShieldCheck } from "lucide-react";
import type { FooterColumn, Link, TrustBadge } from "./types";

export const footerColumns = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Solutions",
    links: [
      { label: "Property managers", href: "/property-managers" },
      { label: "Contractors", href: "/contractors" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Help center", href: "#" },
      { label: "Getting started", href: "#" },
      { label: "Blog", href: "#" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Contact", href: "mailto:hello@documax.app" },
    ],
  },
] satisfies FooterColumn[];

export const footerTrust = [
  { icon: Lock, label: "Isolated per organization" },
  { icon: History, label: "Full audit log" },
  { icon: ShieldCheck, label: "Encrypted in transit & at rest" },
] satisfies TrustBadge[];

export const legalLinks = [
  { label: "Terms", href: "#" },
  { label: "Privacy", href: "#" },
  { label: "Security", href: "#" },
] satisfies Link[];
