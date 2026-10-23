import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // App-gated and API routes have no crawlable content; keep the crawl
        // budget on the landing page, tools, leaderboard and public profiles.
        disallow: [
          "/api/",
          "/admin",
          "/dashboard",
          "/import",
          "/friends",
          "/music",
          "/activity",
          "/logging-in",
          "/login-callback",
          "/s/",
        ],
      },
    ],
    sitemap: "https://dj-scratch.is-a-fullstack.dev/sitemap.xml",
    host: "https://dj-scratch.is-a-fullstack.dev",
  };
}
