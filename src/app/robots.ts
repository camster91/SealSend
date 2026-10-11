import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sealsend.app";
  
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Crawlers must be able to read noindex on application pages. A robots.txt
        // block can still leave the URL in search results without its contents.
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
