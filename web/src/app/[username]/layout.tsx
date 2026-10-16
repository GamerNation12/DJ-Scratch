import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const name = decodeURIComponent(username || "");
  const canonical = `https://dj-scratch.is-a-fullstack.dev/${encodeURIComponent(name)}`;
  let title = `${name} | DJ Scratch`;
  let description = `See ${name}'s music stats: top artists, tracks, albums, listening history, and streaks on DJ Scratch.`;
  try {
    const { sql } = await import("@/lib/db");
    const key = name;
    let rows: any[] = [];
    if (/^\d{5,25}$/.test(key)) {
      rows = await sql`SELECT display_name, discord_username, lastfm_username, bio FROM user_settings WHERE user_id = ${key}`;
    } else {
      rows = await sql`SELECT display_name, discord_username, lastfm_username, bio FROM user_settings
        WHERE REPLACE(REPLACE(discord_username, ' ', ''), '-', '') ILIKE REPLACE(REPLACE(${key}, ' ', ''), '-', '')
           OR REPLACE(REPLACE(lastfm_username, ' ', ''), '-', '') ILIKE REPLACE(REPLACE(${key}, ' ', ''), '-', '')
           OR REPLACE(REPLACE(display_name, ' ', ''), '-', '') ILIKE REPLACE(REPLACE(${key}, ' ', ''), '-', '')`;
    }
    const r = rows[0];
    if (r) {
      const display = r.display_name || r.discord_username || r.lastfm_username || name;
      title = `${display} | DJ Scratch`;
      description = r.bio
        ? `${display} on DJ Scratch: ${String(r.bio).slice(0, 120)}`
        : `See ${display}'s music stats: top artists, tracks, albums, listening history, and streaks on DJ Scratch.`;
    }
  } catch {
    // DB unreachable — fall back to generic metadata.
  }
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
    twitter: { card: "summary", title, description },
  };
}

export default function UsernameLayout({ children }: { children: React.ReactNode }) {
  return children;
}
