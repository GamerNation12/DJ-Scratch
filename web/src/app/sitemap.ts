import type { MetadataRoute } from "next";
import { sql } from "@/lib/db";

const BASE = "https://dj-scratch.is-a-fullstack.dev";

// Public content pages. App-gated pages (admin, dashboard, import,
// logging-in, login-callback, music, friends) stay out of the index.
const STATIC_PATHS = [
  "/",
  "/leaderboard",
  "/download",
  "/support",
  "/guidelines",
  "/terms",
  "/privacy",
  "/community",
  "/tools",
  "/tools/pace",
  "/tools/taste",
  "/tools/whoknows",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const urls: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({
    url: `${BASE}${p}`,
    lastModified: now,
    changeFrequency: p === "/" ? "daily" : "weekly",
    priority: p === "/" ? 1 : 0.7,
  }));

  // Public profiles get indexed too (private/banned excluded).
  try {
    const rows = await sql`
      SELECT COALESCE(NULLIF(display_name, ''), discord_username, lastfm_username) AS slug
      FROM user_settings
      WHERE COALESCE(private_mode, FALSE) = FALSE
        AND COALESCE(is_banned, FALSE) = FALSE
        AND COALESCE(NULLIF(display_name, ''), discord_username, lastfm_username) IS NOT NULL
      LIMIT 5000
    `;
    for (const r of rows as any[]) {
      if (!r.slug) continue;
      urls.push({
        url: `${BASE}/${encodeURIComponent(r.slug)}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  } catch {
    // DB unreachable at build time — static pages still index.
  }
  return urls;
}
