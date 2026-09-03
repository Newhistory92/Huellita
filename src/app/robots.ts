import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_URL_BASE ?? "http://localhost:3000";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/panel", "/api"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
