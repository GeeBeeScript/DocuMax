import type { Metadata } from "next";
import { Noto_Sans, Plus_Jakarta_Sans } from "next/font/google";
import { MotionProvider } from "@/components/motion/motion-provider";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/content/site";
import "./globals.css";

// Display face: free Roobert-like geometric grotesk. Swap via next/font/local
// if a Roobert PRO license is obtained (see docs/DESIGN_SYSTEM.md).
const display = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

// Body face: Noto Sans (same family Miro uses for body copy).
const body = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  openGraph: { siteName: siteConfig.name, type: "website" },
  twitter: { card: "summary_large_image" },
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <MotionProvider>{children}</MotionProvider>
        <Toaster theme="light" position="bottom-right" />
      </body>
    </html>
  );
}
