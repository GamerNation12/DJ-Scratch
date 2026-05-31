import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";
import { neon } from "@neondatabase/serverless";

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

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

    const sql = neon(DB_URL!);

    // Ensure user exists
    await sql`
      INSERT INTO imported_users (id, username)
      VALUES (${userId}, ${username})
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username
    `;

    // Build valid tracks list
    type Track = { artist: string; title: string; album: string; playedAt: string };
    const validTracks: Track[] = [];

    for (const track of chunk) {
      const artist = track.artistName || track.master_metadata_album_artist_name;
      const title = track.trackName || track.master_metadata_track_name;
      const album = track.master_metadata_album_album_name || "";
      const playedAtRaw = track.endTime || track.ts;
      const msPlayed = track.msPlayed || track.ms_played || 0;

      if (!artist || !title || !playedAtRaw || msPlayed < 30000) continue;

      try {
        validTracks.push({ artist, title, album, playedAt: new Date(playedAtRaw).toISOString() });
      } catch {
        continue;
      }
    }

    if (validTracks.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 });
    }

    // neon .transaction() sends ALL inserts in a single HTTP round-trip to Neon
    await sql.transaction(
      validTracks.map((t) =>
        sql`
          INSERT INTO listens (user_id, artist_name, track_name, album_name, played_at)
          VALUES (${userId}, ${t.artist}, ${t.title}, ${t.album}, ${t.playedAt})
          ON CONFLICT (user_id, artist_name, track_name, played_at) DO NOTHING
        `
      )
    );

    return NextResponse.json({ success: true, inserted: validTracks.length });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
