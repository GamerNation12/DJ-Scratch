import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// GET /api/u/[id]/streams?period=overall|7day|...&limit=50&offset=0
// Full listening history, newest first, from local listens (imports +
// synced Last.fm history). Mirrors the access rules of /api/u/[id].
export const revalidate = 60;
export const maxDuration = 30;

const VALID_PERIODS = ["7day", "1month", "3month", "6month", "12month", "overall"] as const;
const PERIOD_DAYS: Record<string, number | null> = {
  "7day": 7,
  "1month": 30,
  "3month": 91,
  "6month": 182,
  "12month": 365,
  "overall": null,
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawUserId } = await params;
  const userId = decodeURIComponent(rawUserId);
  const url = new URL(req.url);
  const p = url.searchParams.get("period");
  const period = (VALID_PERIODS as readonly string[]).includes(p || "") ? p! : "overall";
  const cutoffDays = PERIOD_DAYS[period];
  const cutoffDate = cutoffDays != null ? new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000) : null;
  const limit = Math.max(1, Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 100));
  const offset = Math.max(0, Math.min(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 20000));

  try {
    let rows: any[] = [];
    if (/^\d{5,25}$/.test(userId)) {
      try {
        rows = await sql`
          SELECT user_id, lastfm_username, private_mode, data_source, is_banned, ban_reason
          FROM user_settings
          WHERE user_id = ${userId}
        `;
      } catch {
        rows = [];
      }
    }
    if (rows.length === 0) {
      rows = await sql`
        SELECT user_id, lastfm_username, private_mode, data_source, is_banned, ban_reason
        FROM user_settings
        WHERE REPLACE(REPLACE(discord_username, ' ', ''), '-', '') ILIKE REPLACE(REPLACE(${userId}, ' ', ''), '-', '')
           OR REPLACE(REPLACE(lastfm_username, ' ', ''), '-', '') ILIKE REPLACE(REPLACE(${userId}, ' ', ''), '-', '')
           OR REPLACE(REPLACE(display_name, ' ', ''), '-', '') ILIKE REPLACE(REPLACE(${userId}, ' ', ''), '-', '')
      `;
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found or has not set up the bot." }, { status: 404 });
    }
    const publicRows = rows.filter((r) => !r.private_mode);
    if (publicRows.length === 0) {
      return NextResponse.json({ error: "This profile is private." }, { status: 403 });
    }
    if (publicRows.some((r) => r.is_banned)) {
      return NextResponse.json({ error: "This user is banned." }, { status: 403 });
    }
    const uId = publicRows[0].user_id;

    const [totalRows, items] = await Promise.all([
      cutoffDate
        ? sql`SELECT COUNT(*) AS c FROM listens WHERE user_id = ${uId} AND played_at >= ${cutoffDate}`
        : sql`SELECT COUNT(*) AS c FROM listens WHERE user_id = ${uId}`,
      cutoffDate
        ? sql`SELECT t.track_name AS name, t.artist_name AS artist, t.album_name AS album,
                     l.played_at AS played_at, COALESCE(l.ms_played, 0) AS ms
              FROM listens l JOIN tracks t ON l.track_id = t.id
              WHERE l.user_id = ${uId} AND l.played_at >= ${cutoffDate}
              ORDER BY l.played_at DESC LIMIT ${limit} OFFSET ${offset}`
        : sql`SELECT t.track_name AS name, t.artist_name AS artist, t.album_name AS album,
                     l.played_at AS played_at, COALESCE(l.ms_played, 0) AS ms
              FROM listens l JOIN tracks t ON l.track_id = t.id
              WHERE l.user_id = ${uId}
              ORDER BY l.played_at DESC LIMIT ${limit} OFFSET ${offset}`,
    ]);

    // Backfill completeness: when the Last.fm sync hasn't finished, the
    // newest scrobbles may lag behind the live profile.
    let backfillDone: boolean | null = null;
    try {
      const srows = await sql`SELECT backfill_done FROM fm_sync_state WHERE user_id = ${uId}`;
      if (srows.length > 0) backfillDone = !!(srows[0] as any).backfill_done;
    } catch { /* table may not exist */ }

    return NextResponse.json({
      success: true,
      period,
      total: parseInt((totalRows[0] as any)?.c || "0", 10) || 0,
      limit,
      offset,
      backfillDone,
      streams: (items as any[]).map((r) => ({
        name: r.name,
        artist: r.artist,
        album: r.album || null,
        playedAt: new Date(r.played_at).toISOString(),
        uts: String(Math.floor(new Date(r.played_at).getTime() / 1000)),
        ms: parseInt(r.ms || "0", 10) || 0,
      })),
    });
  } catch (error) {
    console.error("Streams error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
