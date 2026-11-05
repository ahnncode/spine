import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/public";

/** Search engines may index the public pages; the signed-in app stays out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/book/", "/u/", "/join/", "/privacy", "/terms"],
      disallow: ["/feed", "/you", "/shelf", "/search", "/add", "/scan", "/import", "/sharpen", "/rank/", "/notifications", "/people", "/welcome", "/start", "/login", "/wrap/", "/u/*/shelf", "/u/*/follows"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
