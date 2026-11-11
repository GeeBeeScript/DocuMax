/**
 * Global site copy. All user-facing marketing text lives in /content as typed
 * config so components stay presentational (see docs/CONVENTIONS.md).
 */
export const siteConfig = {
  name: "DocuMax",
  tagline: "Paperwork in. Polished statements out.",
  description:
    "DocuMax turns supplier invoices and receipts into checked, structured data and polished monthly cost statements per property or job.",
  /** Canonical origin for metadata, sitemap and OG images. */
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

/** Public marketing routes — used by the sitemap. */
export const publicRoutes = ["/", "/pricing", "/property-managers", "/contractors", "/signup", "/login"] as const;
