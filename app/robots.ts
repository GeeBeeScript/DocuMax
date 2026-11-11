import type { MetadataRoute } from "next";
import { siteConfig } from "@/content/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/api", "/design"] },
    sitemap: new URL("/sitemap.xml", siteConfig.url).toString(),
  };
}
