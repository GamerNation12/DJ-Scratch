import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: "https://dj-scratch.is-a-fullstack.dev/sitemap.xml",
  };
}
