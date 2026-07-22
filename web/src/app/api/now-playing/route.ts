import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "eee299142ac5fe73e5eb5dcd1c29bcae";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;
  const session = user ? { user } : null;

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const sql = postgres(DB_URL!);
    const row = await sql`
      SELECT lastfm_username FROM user_settings WHERE user_id = ${userId}
    `;

    if (row.length === 0 || !row[0].lastfm_username) {
      return NextResponse.json({ playing: false, error: "not_linked" });
    }

    const lastfmUsername = row[0].lastfm_username;

    const res = await fetch(
      `http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${lastfmUsername}&api_key=${LASTFM_API_KEY}&format=json&limit=1`,
      { next: { revalidate: 0 } }
    );
    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ playing: false, error: data.message });
    }

    const tracks = data.recenttracks?.track;
    if (!tracks || tracks.length === 0) {
      return NextResponse.json({ playing: false });
    }

    const track = tracks[0];
    const isNowPlaying = track["@attr"]?.nowplaying === "true";

    if (isNowPlaying) {
      return NextResponse.json({
        playing: true,
        track: {
          name: track.name,
          artist: track.artist["#text"],
          album: track.album["#text"],
          image: (track.image && track.image.length > 3) ? (track.image[3]["#text"] || track.image[2]["#text"] || null) : null,
          url: track.url,
        }
      });
    }

    return NextResponse.json({ playing: false });
  } catch (error) {
    console.error("Error fetching now playing:", error);
    return NextResponse.json({ playing: false, error: "Internal Server Error" }, { status: 500 });
  }
}
