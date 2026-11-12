import { PAGE } from "../layout";

export interface Branding {
  orgName: string;
  /** data: URI (the header template can't fetch URLs). */
  logoDataUri: string | null;
  /** #rrggbb */
  brandColor: string;
  footerText: string | null;
}

export const DEFAULT_BRAND_COLOR = "#ffd02f";

/**
 * Page header (Chromium `headerTemplate`): brand-colour bar, logo + organization name, report title. Rendered on
 * every page by the browser; inline styles only (header templates don't see the page's stylesheet).
 */
export function BrandBar({ branding, title }: { branding: Branding; title: string }) {
  const font = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif';
  return (
    <div
      style={{
        width: "100%",
        margin: 0,
        fontFamily: font,
        fontSize: "8pt",
        color: "#050038",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      <div style={{ height: "2.2mm", background: branding.brandColor }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6mm",
          padding: `4mm ${PAGE.marginX}mm 0`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "3mm", minWidth: 0 }}>
          {branding.logoDataUri && (
            // eslint-disable-next-line @next/next/no-img-element -- static HTML for the PDF header, not a Next page
            <img
              src={branding.logoDataUri}
              alt=""
              style={{ height: "9mm", maxWidth: "40mm", objectFit: "contain" }}
            />
          )}
          <span style={{ fontSize: "10pt", fontWeight: 800, whiteSpace: "nowrap" }}>{branding.orgName}</span>
        </div>
        <span
          style={{ fontWeight: 700, color: "#6b6b80", textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          {title}
        </span>
      </div>
    </div>
  );
}
