import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { sql, withDbTimeout } from "@/lib/db";

const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "eee299142ac5fe73e5eb5dcd1c29bcae";

export const revalidate = 15; // Short cache so polls share responses instead of stampeding DB + Last.fm.
export const maxDuration = 15; // Fail fast instead of hanging to Vercel's 300s kill.

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
    const row = await withDbTimeout(sql`
      SELECT lastfm_username FROM user_settings WHERE user_id = ${userId}
    `);

    if (row.length === 0 || !row[0].lastfm_username) {
      return NextResponse.json({ playing: false, error: "not_linked" });
    }

    const lastfmUsername = row[0].lastfm_username;

    const res = await fetch(
      `http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${lastfmUsername}&api_key=${LASTFM_API_KEY}&format=json&limit=1`,
      { next: { revalidate: 0 }, signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json().catch(() => null);
    if (!data) {
      return NextResponse.json({ playing: false, error: "upstream_timeout" });
    }

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
