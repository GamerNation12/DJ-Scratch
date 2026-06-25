import { NextResponse } from "next/server";
import postgres from "postgres";
import { verifyToken } from "@/lib/jwt";

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "696438a21fc540d4cb27faa736239e75";
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;

async function getDeezerArtistImage(artistName: string) {
  try {
    const res = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}`);
    if (!res.ok) return { url: null };
    const data = await res.json();
    if (data.data?.length > 0) {
      const artist = data.data[0];
      if (artist.picture_xl || artist.picture_big || artist.picture) {
        return { url: artist.picture_xl || artist.picture_big || artist.picture };
      }
    }
    return { url: null };
  } catch (e: any) {
    return { url: null };
  }
}

async function getDeezerTrackImage(trackName: string, artistName: string) {
  try {
    const res = await fetch(`https://api.deezer.com/search/track?q=${encodeURIComponent(trackName + " " + artistName)}`);
    if (!res.ok) return { url: null };
    const data = await res.json();
    if (data.data?.length > 0) {
      const track = data.data[0];
      if (track.album?.cover_xl || track.album?.cover_big || track.album?.cover) {
        return { url: track.album?.cover_xl || track.album?.cover_big || track.album?.cover };
      }
    }
    return { url: null };
  } catch (e: any) {
    return { url: null };
  }
}

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
    
    let rows = await sql`
      SELECT user_id, lastfm_username, private_mode, data_source, discord_username, display_name, is_banned, ban_reason 
      FROM user_settings 
      WHERE user_id = ${userId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found or has not set up the bot." }, { status: 404 });
    }

    if (rows[0].is_banned) {
      return NextResponse.json({ error: `This user is banned. Reason: ${rows[0].ban_reason || 'No reason provided'}` }, { status: 403 });
    }

    const lastfm_username = rows[0].lastfm_username;

    if (!lastfm_username) {
      return NextResponse.json({ error: "This user has not linked a Last.fm account." }, { status: 404 });
    }

    // Fetch Last.fm Data
    let lastfmData = {
      playcount: 0,
      topArtists: [] as any[],
      recentTracks: [] as any[],
      topTracks: [] as any[],
      topAlbums: [] as any[]
    };

    try {
      const [infoRes, artistRes, recentRes, tracksRes, albumsRes] = await Promise.all([
        fetch(`http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${lastfm_username}&api_key=${LASTFM_API_KEY}&format=json`),
        fetch(`http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${lastfm_username}&api_key=${LASTFM_API_KEY}&format=json&limit=12`),
        fetch(`http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${lastfm_username}&api_key=${LASTFM_API_KEY}&format=json&limit=10`),
        fetch(`http://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${lastfm_username}&api_key=${LASTFM_API_KEY}&format=json&limit=5`),
        fetch(`http://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${lastfm_username}&api_key=${LASTFM_API_KEY}&format=json&limit=6`)
      ]);

      const infoData = await infoRes.json();
      const artistData = await artistRes.json();
      const recentData = await recentRes.json();
      const tracksData = await tracksRes.json();
      const albumsData = await albumsRes.json();

      if (!infoData.error) {
        lastfmData.playcount = parseInt(infoData.user.playcount || "0", 10);
      }

      if (!artistData.error && artistData.topartists?.artist) {
        const artistsList = artistData.topartists.artist;
        for (const a of artistsList) {
          let imageUrl = a.image?.find((i: any) => i.size === "extralarge")?.["#text"] || null;
          if (imageUrl && imageUrl.includes("2a96cbd8b46e442fc41c2b86b821562f")) imageUrl = null;
          if (!imageUrl) {
            const imgRes = await getDeezerArtistImage(a.name);
            imageUrl = imgRes?.url || null;
          }
          lastfmData.topArtists.push({ name: a.name, playcount: a.playcount, url: a.url, image: imageUrl });
        }
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

      if (!tracksData.error && tracksData.toptracks?.track) {
        const topTracksList = Array.isArray(tracksData.toptracks.track) ? tracksData.toptracks.track : [tracksData.toptracks.track];
        for (const t of topTracksList) {
          let imageUrl = t.image?.find((i: any) => i.size === "extralarge" || i.size === "large")?.["#text"] || null;
          if (imageUrl && imageUrl.includes("2a96cbd8b46e442fc41c2b86b821562f")) imageUrl = null;
          if (!imageUrl) {
            const imgRes = await getDeezerTrackImage(t.name, t.artist?.name || "");
            imageUrl = imgRes?.url || null;
          }
          lastfmData.topTracks.push({ name: t.name, artist: t.artist?.name, playcount: t.playcount, url: t.url, image: imageUrl });
        }
      }

      if (!albumsData.error && albumsData.topalbums?.album) {
        const topAlbums = Array.isArray(albumsData.topalbums.album) ? albumsData.topalbums.album : [albumsData.topalbums.album];
        for (const a of topAlbums) {
          let imageUrl = a.image?.find((i: any) => i.size === "extralarge")?.["#text"] || null;
          if (imageUrl && imageUrl.includes("2a96cbd8b46e442fc41c2b86b821562f")) imageUrl = null;
          lastfmData.topAlbums.push({ name: a.name, artist: a.artist?.name, playcount: a.playcount, url: a.url, image: imageUrl });
        }
      }

    } catch (e) {
      console.error("Last.fm fetch error:", e);
      return NextResponse.json({ error: "Failed to fetch Last.fm data." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      stats: lastfmData,
    });

  } catch (error) {
    console.error("Mobile stats error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
