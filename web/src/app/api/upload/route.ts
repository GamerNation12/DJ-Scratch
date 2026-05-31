import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";
import { neon } from "@neondatabase/serverless";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const username = session.user.name || "Unknown";

  try {
    const chunk = await req.json();
    if (!Array.isArray(chunk) || chunk.length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Validate it looks like Spotify data
    const sample = chunk[0];
    const isSpotifyData =
      "trackName" in sample || "master_metadata_track_name" in sample;
    if (!isSpotifyData) {
      return NextResponse.json(
        { error: "Invalid data format. Does not match Spotify schema." },
        { status: 400 }
      );
    }

    const sql = neon(process.env.DATABASE_URL!);

    // Ensure user exists
    await sql`
      INSERT INTO imported_users (id, username)
      VALUES (${userId}, ${username})
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username
    `;

    // Filter and build arrays for unnest bulk insert
    const userIds: string[] = [];
    const artists: string[] = [];
    const titles: string[] = [];
    const albums: string[] = [];
    const dates: string[] = [];

    for (const track of chunk) {
      const artist = track.artistName || track.master_metadata_album_artist_name;
      const title = track.trackName || track.master_metadata_track_name;
      const album = track.master_metadata_album_album_name || "";
      const playedAtRaw = track.endTime || track.ts;
      const msPlayed = track.msPlayed || track.ms_played || 0;

      if (!artist || !title || !playedAtRaw || msPlayed < 30000) continue;

      try {
        const playedAt = new Date(playedAtRaw).toISOString();
        userIds.push(userId);
        artists.push(artist);
        titles.push(title);
        albums.push(album);
        dates.push(playedAt);
      } catch {
        continue;
      }
    }

    if (userIds.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 });
    }

    // Single bulk insert via unnest - sends ONE query instead of N queries
    await sql`
      INSERT INTO listens (user_id, artist_name, track_name, album_name, played_at)
      SELECT * FROM unnest(
        ${userIds}::text[],
        ${artists}::text[],
        ${titles}::text[],
        ${albums}::text[],
        ${dates}::timestamptz[]
      ) AS t(user_id, artist_name, track_name, album_name, played_at)
      ON CONFLICT (user_id, artist_name, track_name, played_at) DO NOTHING
    `;

    return NextResponse.json({ success: true, inserted: userIds.length });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
