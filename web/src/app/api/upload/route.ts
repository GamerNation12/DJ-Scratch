import { sql } from "@vercel/postgres";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

// Spotify history can look like:
// { "endTime": "2023-01-01 12:00", "artistName": "Artist", "trackName": "Track", "msPlayed": 120000 }
// OR endsong.json:
// { "ts": "2023-01-01T12:00:00Z", "master_metadata_album_artist_name": "Artist", "master_metadata_track_name": "Track", "ms_played": 120000 }

export async function POST(req: Request) {
  const session = await getServerSession();

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
    const isSpotifyData = sample.hasOwnProperty("trackName") || sample.hasOwnProperty("master_metadata_track_name");
    if (!isSpotifyData) {
      return NextResponse.json({ error: "Invalid data format. Does not match Spotify schema." }, { status: 400 });
    }

    // Ensure user exists in the imported_users table
    await sql`
      INSERT INTO imported_users (id, username)
      VALUES (${userId}, ${username})
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username;
    `;

    let insertedCount = 0;

    for (const track of chunk) {
      // Handle both formats
      const artist = track.artistName || track.master_metadata_album_artist_name;
      const title = track.trackName || track.master_metadata_track_name;
      const album = track.master_metadata_album_album_name || "";
      const playedAtRaw = track.endTime || track.ts;
      
      // Spotify sometimes counts skips (less than 30s) as plays. We can filter them out.
      const msPlayed = track.msPlayed || track.ms_played || 0;
      
      if (!artist || !title || !playedAtRaw || msPlayed < 30000) {
        continue; // skip incomplete data or skips
      }

      const playedAt = new Date(playedAtRaw).toISOString();

      try {
        await sql`
          INSERT INTO listens (user_id, artist_name, track_name, album_name, played_at)
          VALUES (${userId}, ${artist}, ${title}, ${album}, ${playedAt})
          ON CONFLICT (user_id, artist_name, track_name, played_at) DO NOTHING;
        `;
        insertedCount++;
      } catch (err) {
        console.error("Error inserting track", err);
      }
    }

    return NextResponse.json({ success: true, inserted: insertedCount });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
