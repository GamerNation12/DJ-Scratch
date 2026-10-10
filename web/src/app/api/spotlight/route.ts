import { NextResponse } from "next/server";
import { sql, withDbTimeout } from "@/lib/db";

// Public mirror of the daily community spotlight (no auth needed).
// The bot upserts spotlight_current on every board post.
export const revalidate = 300;
export const maxDuration = 10;

const SUPPORT_GUILD_ID = "1527127381897383946";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guild = (url.searchParams.get("guild") || SUPPORT_GUILD_ID).replace(/\D/g, "") || SUPPORT_GUILD_ID;
  try {
    const rows = await withDbTimeout(sql`
      SELECT kind, title, subtitle, posted_at FROM spotlight_current WHERE guild_id = ${guild}
    `);
    const picks: Record<string, { title: string; subtitle: string; posted_at: string | null }> = {};
    for (const r of rows as any[]) {
      picks[r.kind] = {
        title: r.title || "",
        subtitle: r.subtitle || "",
        posted_at: r.posted_at ? new Date(r.posted_at).toISOString() : null,
      };
    }
    return NextResponse.json({ guild, picks });
  } catch {
    return NextResponse.json({ guild, picks: {} });
  }
}
