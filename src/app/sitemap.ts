import type { MetadataRoute } from "next";
import { GUIDES, SITE_URL } from "@/lib/site";

// Static pages carry a fixed date rather than the build time: a lastModified
// that changes on every deploy trains crawlers to ignore the field.
const SITE_UPDATED = new Date("2026-09-04");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: SITE_UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/guides`, lastModified: SITE_UPDATED, changeFrequency: "weekly", priority: 0.8 },
    ...GUIDES.map((g) => ({
      url: `${SITE_URL}/guides/${g.slug}`,
      lastModified: new Date(g.updated),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/privacy`, lastModified: SITE_UPDATED, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/disclaimer`, lastModified: SITE_UPDATED, changeFrequency: "yearly", priority: 0.2 },
  ];
}
