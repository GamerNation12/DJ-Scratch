import { NextResponse } from "next/server";
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "eee299142ac5fe73e5eb5dcd1c29bcae";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const period = searchParams.get('period') || 'overall';

  if (!userId) {
    return NextResponse.json({ error: "Missing userId parameter." }, { status: 400 });
  }

  try {
    const sql = postgres(DB_URL!);
    
    const rows = await sql`
      SELECT user_id, lastfm_username 
      FROM user_settings 
      WHERE user_id = ${userId}
    `;

    if (rows.length === 0 || !rows[0].lastfm_username) {
      return NextResponse.json({ error: "User has not set up their Last.fm account." }, { status: 404 });
    }

    const lastfm_username = rows[0].lastfm_username;

    // Fetch Last.fm Data
    let lastfmData = {
      playcount: 0,
      topArtists: [] as any[],
      topAlbums: [] as any[],
      topTracks: [] as any[],
      recentTracks: [] as any[]
    };

    try {
      const [infoRes, artistRes, albumRes, trackRes, recentRes] = await Promise.all([
        fetch(`http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${lastfm_username}&api_key=${LASTFM_API_KEY}&format=json`),
        fetch(`http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${lastfm_username}&api_key=${LASTFM_API_KEY}&format=json&limit=5&period=${period}`),
        fetch(`http://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${lastfm_username}&api_key=${LASTFM_API_KEY}&format=json&limit=5&period=${period}`),
        fetch(`http://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${lastfm_username}&api_key=${LASTFM_API_KEY}&format=json&limit=5&period=${period}`),
        fetch(`http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${lastfm_username}&api_key=${LASTFM_API_KEY}&format=json&limit=5`)
      ]);

      const [infoData, artistData, albumData, trackData, recentData] = await Promise.all([
        infoRes.json(), artistRes.json(), albumRes.json(), trackRes.json(), recentRes.json()
      ]);

      if (!infoData.error) {
        lastfmData.playcount = parseInt(infoData.user?.playcount || "0", 10);
      }

      if (!artistData.error && artistData.topartists?.artist) {
        const artists = Array.isArray(artistData.topartists.artist) ? artistData.topartists.artist : [artistData.topartists.artist];
        lastfmData.topArtists = artists.map((a: any) => ({
          name: a.name,
          playcount: a.playcount,
          url: a.url,
          image: a.image?.find((i: any) => i.size === "extralarge")?.["#text"] || null
        }));
      }

      if (!albumData.error && albumData.topalbums?.album) {
        const albums = Array.isArray(albumData.topalbums.album) ? albumData.topalbums.album : [albumData.topalbums.album];
        lastfmData.topAlbums = albums.map((a: any) => ({
          name: a.name,
          artist: a.artist?.name,
          playcount: a.playcount,
          url: a.url,
          image: a.image?.find((i: any) => i.size === "extralarge")?.["#text"] || null
        }));
      }

      if (!trackData.error && trackData.toptracks?.track) {
        const tracks = Array.isArray(trackData.toptracks.track) ? trackData.toptracks.track : [trackData.toptracks.track];
        lastfmData.topTracks = tracks.map((t: any) => ({
          name: t.name,
          artist: t.artist?.name,
          playcount: t.playcount,
          url: t.url,
          image: t.image?.find((i: any) => i.size === "extralarge")?.["#text"] || null
        }));
      }

      if (!recentData.error && recentData.recenttracks?.track) {
        const tracks = Array.isArray(recentData.recenttracks.track) ? recentData.recenttracks.track : [recentData.recenttracks.track];
        lastfmData.recentTracks = tracks.map((t: any) => ({
          name: t.name,
          artist: t.artist?.["#text"] || t.artist?.name,
          album: t.album?.["#text"],
          url: t.url,
          image: t.image?.find((i: any) => i.size === "large")?.["#text"] || null,
          nowPlaying: t["@attr"]?.nowplaying === "true",
          date: t.date?.uts || null
        }));
      }

    } catch (e) {
      console.error("Last.fm fetch error:", e);
      return NextResponse.json({ error: "Failed to fetch Last.fm data." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      lastfmUsername: lastfm_username,
      stats: lastfmData
    });

  } catch (error) {
    console.error("Activity stats error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
