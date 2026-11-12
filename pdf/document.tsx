import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandBar, type Branding } from "./components/brand-bar";
import { PageFooter } from "./components/page-footer";
import { BODY_HEIGHT, PAGE } from "./layout";
import { printCss } from "./styles";

/** A report laid out into pages by its template (pdf/templates/*). */
export interface ReportDocument {
  /** Shown in the page header and used for the PDF title. */
  title: string;
  pages: ReactElement[];
}

export interface RenderedReport {
  html: string;
  headerTemplate: string;
  footerTemplate: string;
  pageCount: number;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Static HTML + Chromium header/footer templates for `page.pdf()` (worker/pdf/render.ts). */
export function renderReport(
  doc: ReportDocument,
  branding: Branding,
  generatedLabel: string,
): RenderedReport {
  const body = doc.pages
    .map(
      (page) =>
        `<section class="page" style="height:${BODY_HEIGHT}mm">${renderToStaticMarkup(page)}</section>`,
    )
    .join("");
  const brand = /^#[0-9a-fA-F]{6}$/.test(branding.brandColor) ? branding.brandColor : "#ffd02f";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title><style>${printCss()}</style><style>:root{--brand:${brand}}</style></head><body>${body}</body></html>`;
  return {
    html,
    headerTemplate: renderToStaticMarkup(
      <BrandBar branding={{ ...branding, brandColor: brand }} title={doc.title} />,
    ),
    footerTemplate: renderToStaticMarkup(
      <PageFooter footerText={branding.footerText} generated={generatedLabel} />,
    ),
    pageCount: doc.pages.length,
  };
}

/** Margins for `page.pdf()` — the header/footer templates live inside them. */
export const PDF_MARGINS = {
  top: `${PAGE.marginTop}mm`,
  bottom: `${PAGE.marginBottom}mm`,
  left: `${PAGE.marginX}mm`,
  right: `${PAGE.marginX}mm`,
};
