import type { MetadataRoute } from "next";
import { getSitemapEntries, SITE_URL } from "@/lib/public";

/** Public profiles and every book someone has ranked, for search engines. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getSitemapEntries();
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    ...entries.map((e) => ({
      url: e.kind === "book" ? `${SITE_URL}/book/${e.key}` : `${SITE_URL}/u/${e.key}`,
      lastModified: e.updated,
      changeFrequency: "weekly" as const,
      priority: e.kind === "book" ? 0.7 : 0.5,
    })),
  ];
}
