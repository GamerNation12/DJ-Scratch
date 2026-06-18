import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "696438a21fc540d4cb27faa736239e75";

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
    const sql = neon(DB_URL!);
    const row = await sql`
      SELECT lastfm_username FROM user_settings WHERE user_id = ${userId}
    `;

    if (row.length === 0 || !row[0].lastfm_username) {
      return NextResponse.json({ success: false, error: "not_linked" });
    }

    const lastfmUsername = row[0].lastfm_username;

    // Fetch user info (playcount, registered, etc)
    const infoRes = await fetch(
      `http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${lastfmUsername}&api_key=${LASTFM_API_KEY}&format=json`,
      { next: { revalidate: 300 } } // Cache for 5 mins
    );
    const infoData = await infoRes.json();

    // Fetch top artist
    const artistRes = await fetch(
      `http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${lastfmUsername}&api_key=${LASTFM_API_KEY}&format=json&limit=1`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    );
    const artistData = await artistRes.json();

    if (infoData.error) {
      return NextResponse.json({ success: false, error: infoData.message });
    }

    const userStats = {
      username: infoData.user.name,
      playcount: parseInt(infoData.user.playcount || "0", 10),
      registered: infoData.user.registered?.unixtime || null,
      topArtist: artistData.topartists?.artist?.[0]?.name || "None",
      topArtistPlays: parseInt(artistData.topartists?.artist?.[0]?.playcount || "0", 10),
      url: infoData.user.url
    };

    return NextResponse.json({ success: true, stats: userStats });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
