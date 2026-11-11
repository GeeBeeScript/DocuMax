import { ImageResponse } from "next/og";
import { siteConfig } from "@/content/site";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Hex values mirror tokens in app/globals.css (CSS variables aren't available in OG rendering).
const INK = "#050038";
const YELLOW = "#FFD02F";
const CANVAS = "#F7F7F5";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: CANVAS,
        backgroundImage: "radial-gradient(#D9D8E3 2px, transparent 2px)",
        backgroundSize: "32px 32px",
        color: INK,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: YELLOW, display: "flex" }} />
        <div style={{ fontSize: 44, fontWeight: 800 }}>{siteConfig.name}</div>
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", fontSize: 80, fontWeight: 800, lineHeight: 1.05 }}
      >
        <span>Paperwork in.</span>
        <span style={{ background: YELLOW, padding: "0 16px", alignSelf: "flex-start" }}>
          Polished statements out.
        </span>
      </div>
      <div style={{ fontSize: 28, color: "#3A3760" }}>For property managers & home-service contractors</div>
    </div>,
    size,
  );
}
