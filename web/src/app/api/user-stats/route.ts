import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import postgres from "postgres";

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
    const sql = postgres(DB_URL!);
    
    const row = await sql`
      SELECT lastfm_username, spotify_refresh_token FROM user_settings WHERE user_id = ${userId}
    `;
    const lastfmUsername = row.length > 0 ? row[0].lastfm_username : null;
    const hasSpotifyRemote = row.length > 0 && row[0].spotify_refresh_token ? true : false;

    let userStats: any = {
      hasLastfm: false,
      hasSpotify: false,
      hasSpotifyRemote: hasSpotifyRemote,
    };

    if (lastfmUsername) {
      try {
        const infoRes = await fetch(
          `http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${lastfmUsername}&api_key=${LASTFM_API_KEY}&format=json`,
          { next: { revalidate: 300 } }
        );
        const infoData = await infoRes.json();
        
        const artistRes = await fetch(
          `http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${lastfmUsername}&api_key=${LASTFM_API_KEY}&format=json&limit=1`,
          { next: { revalidate: 3600 } }
        );
        const artistData = await artistRes.json();
        
        if (!infoData.error) {
          userStats.hasLastfm = true;
          userStats.lastfm = {
            username: infoData.user.name,
            playcount: parseInt(infoData.user.playcount || "0", 10),
            registered: infoData.user.registered?.unixtime || null,
            topArtist: artistData.topartists?.artist?.[0]?.name || "None",
            topArtistPlays: parseInt(artistData.topartists?.artist?.[0]?.playcount || "0", 10),
            url: infoData.user.url
          };
        }
      } catch (e) {
        console.error("Last.fm fetch error", e);
      }
    }

    const spotifyPlaysRow = await sql`SELECT COUNT(*) as count FROM listens WHERE user_id = ${userId}`;
    const spotifyPlaycount = parseInt(spotifyPlaysRow[0]?.count || "0", 10);
    
    if (spotifyPlaycount > 0) {
      userStats.hasSpotify = true;
      userStats.spotify = { playcount: spotifyPlaycount, topArtist: "None", topArtistPlays: 0 };
      
      const spotifyTopArtistRow = await sql`
        SELECT artist_name, COUNT(*) as playcount
        FROM listens
        WHERE user_id = ${userId}
        GROUP BY artist_name
        ORDER BY playcount DESC
        LIMIT 1
      `;
      if (spotifyTopArtistRow.length > 0) {
        userStats.spotify.topArtist = spotifyTopArtistRow[0].artist_name;
        userStats.spotify.topArtistPlays = parseInt(spotifyTopArtistRow[0].playcount || "0", 10);
      }
    }

    if (!userStats.hasLastfm && !userStats.hasSpotify && !userStats.hasSpotifyRemote) {
      return NextResponse.json({ success: false, error: "not_linked" });
    }

    return NextResponse.json({ success: true, stats: userStats });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
