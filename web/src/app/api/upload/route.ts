import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";
import { getDb } from "@/lib/db";

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

    // Basic server-side validation
    const sample = chunk[0];
    const isSpotifyData =
      sample.hasOwnProperty("trackName") ||
      sample.hasOwnProperty("master_metadata_track_name");
    if (!isSpotifyData) {
      return NextResponse.json(
        { error: "Invalid data format. Does not match Spotify schema." },
        { status: 400 }
      );
    }

    const sql = getDb();

    // Ensure user exists
    await sql`
      INSERT INTO imported_users (id, username)
      VALUES (${userId}, ${username})
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username
    `;

    // Filter valid tracks
    const validTracks: { artist: string; title: string; album: string; playedAt: string }[] = [];
    for (const track of chunk) {
      const artist =
        track.artistName || track.master_metadata_album_artist_name;
      const title =
        track.trackName || track.master_metadata_track_name;
      const album = track.master_metadata_album_album_name || "";
      const playedAtRaw = track.endTime || track.ts;
      const msPlayed = track.msPlayed || track.ms_played || 0;

      if (!artist || !title || !playedAtRaw || msPlayed < 30000) continue;

      try {
        const playedAt = new Date(playedAtRaw).toISOString();
        validTracks.push({ artist, title, album, playedAt });
      } catch {
        continue;
      }
    }

    if (validTracks.length > 0) {
      // Insert using neon tagged template with transaction
      for (const t of validTracks) {
        await sql`
          INSERT INTO listens (user_id, artist_name, track_name, album_name, played_at)
          VALUES (${userId}, ${t.artist}, ${t.title}, ${t.album}, ${t.playedAt})
          ON CONFLICT (user_id, artist_name, track_name, played_at) DO NOTHING
        `;
      }
    }

    return NextResponse.json({ success: true, inserted: validTracks.length });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
