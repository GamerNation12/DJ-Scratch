import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Web equivalent of the bot's /globalwhoknows commands: who across the whole
// bot listens to an artist / track / album most (imported listens).
// Private-mode users are excluded, same as on Discord.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = (searchParams.get("kind") || "artist").toLowerCase();
  const artist = (searchParams.get("artist") || "").trim();
  const track = (searchParams.get("track") || "").trim();
  const album = (searchParams.get("album") || "").trim();

  if (!artist) {
    return NextResponse.json({ error: "Missing ?artist=" }, { status: 400 });
  }
  if (kind === "track" && !track) {
    return NextResponse.json({ error: "Missing ?track= (with ?artist=)" }, { status: 400 });
  }
  if (kind === "album" && !album) {
    return NextResponse.json({ error: "Missing ?album= (with ?artist=)" }, { status: 400 });
  }
  if (!["artist", "track", "album"].includes(kind)) {
    return NextResponse.json({ error: "kind must be artist, track or album" }, { status: 400 });
  }

  try {
    const extraFilter =
      kind === "track" ? sql`AND LOWER(t.track_name) = LOWER(${track})` :
      kind === "album" ? sql`AND LOWER(t.album_name) = LOWER(${album})` :
      sql``;

    const rows = await sql`
      SELECT l.user_id,
             COUNT(*) AS plays,
             COALESCE(us.display_name, us.discord_username, us.lastfm_username, l.user_id) AS name,
             iu.avatar_url AS avatar
      FROM listens l
      JOIN tracks t ON l.track_id = t.id
      LEFT JOIN user_settings us ON us.user_id = l.user_id
      LEFT JOIN imported_users iu ON iu.id = l.user_id
      WHERE LOWER(t.artist_name) = LOWER(${artist})
      ${extraFilter}
      AND (us.private_mode IS NOT TRUE)
      GROUP BY l.user_id, name, avatar
      ORDER BY plays DESC
      LIMIT 15
    `;

    const countRows = await sql`
      SELECT COUNT(DISTINCT l.user_id) AS listeners
      FROM listens l
      JOIN tracks t ON l.track_id = t.id
      LEFT JOIN user_settings us ON us.user_id = l.user_id
      WHERE LOWER(t.artist_name) = LOWER(${artist})
      ${extraFilter}
      AND (us.private_mode IS NOT TRUE)
    `;

    const top = rows.map((r: any) => ({
      userId: r.user_id,
      name: r.name,
      avatar: r.avatar || null,
      plays: parseInt(r.plays, 10),
    }));
    const topTotal = top.reduce((s, r) => s + r.plays, 0);

    return NextResponse.json({
      success: true,
      kind,
      artist,
      track: kind === "track" ? track : undefined,
      album: kind === "album" ? album : undefined,
      listeners: parseInt(countRows[0]?.listeners || "0", 10),
      leaderboard: top.map((r) => ({
        ...r,
        share: topTotal > 0 ? Math.round((r.plays / topTotal) * 100) : 0,
      })),
    });
  } catch (error) {
    console.error("WhoKnows error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
