import type { MetadataRoute } from "next";
import { publicRoutes, siteConfig } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((path) => ({
    url: new URL(path, siteConfig.url).toString(),
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
