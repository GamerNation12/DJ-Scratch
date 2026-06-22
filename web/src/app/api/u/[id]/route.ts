import { NextResponse } from "next/server";
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "696438a21fc540d4cb27faa736239e75";
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

export const revalidate = 60; // Cache for 60 seconds

// Removed Spotify logic since it requires Premium now

async function getDeezerArtistImage(artistName: string) {
  try {
    const res = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}`, {
      next: { revalidate: 86400 } // Cache artist image for 24 hours
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Deezer search error for ${artistName}:`, errorText);
      return { url: null, error: `Search HTTP ${res.status}: ${errorText}` };
    }
    const data = await res.json();
    if (data.data?.length > 0) {
      const artist = data.data[0];
      if (artist.picture_xl || artist.picture_big || artist.picture) {
        return { url: artist.picture_xl || artist.picture_big || artist.picture, error: null };
      }
      return { url: null, error: "No images found for artist" };
    }
    return { url: null, error: "Artist not found" };
  } catch (e: any) {
    return { url: null, error: e.message || String(e) };
  }
}


export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params;

  try {
    const sql = postgres(DB_URL!);
    
    // Fetch user settings and Last.fm username
    let rows;
    try {
      rows = await sql`
        SELECT user_id, lastfm_username, private_mode, data_source, discord_username 
        FROM user_settings 
        WHERE discord_username ILIKE ${userId} OR lastfm_username ILIKE ${userId}
      `;
    } catch (e: any) {
      if (e.message?.includes('column "discord_username" does not exist') || e.code === '42703') {
        await sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS discord_username TEXT`;
        
        // Backfill discord_username from website_logs for users who have logged in before
        await sql`
          UPDATE user_settings 
          SET discord_username = (
            SELECT username FROM website_logs 
            WHERE website_logs.user_id = user_settings.user_id 
            AND website_logs.action = 'Website Login'
            ORDER BY timestamp DESC LIMIT 1
          ) 
          WHERE discord_username IS NULL
        `;

        rows = await sql`
          SELECT user_id, lastfm_username, private_mode, data_source, discord_username 
          FROM user_settings 
          WHERE discord_username ILIKE ${userId} OR lastfm_username ILIKE ${userId}
        `;
      } else {
        throw e;
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found or has not set up the bot." }, { status: 404 });
    }

    const publicRows = rows.filter(r => !r.private_mode);

    if (publicRows.length === 0) {
      return NextResponse.json({ error: "This profile is private." }, { status: 403 });
    }

    // Since they share the same lastfm_username, we can just use the first one's lastfm_username
    const lastfm_username = publicRows[0].lastfm_username;

    if (!lastfm_username) {
      return NextResponse.json({ error: "This user has not linked a Last.fm account." }, { status: 404 });
    }

    // Fetch Discord Info for ALL public users
    let discordUsers: any[] = [];
    
    await Promise.all(publicRows.map(async (r) => {
      let discordUser = { name: "Unknown User", avatar: null as string | null };
      try {
        const discordRes = await fetch(`https://discord.com/api/v10/users/${r.user_id}`, {
          headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
          next: { revalidate: 3600 } 
        });
        if (discordRes.ok) {
          const dData = await discordRes.json();
          discordUser.name = dData.global_name || dData.username;
          if (dData.avatar) {
            discordUser.avatar = `https://cdn.discordapp.com/avatars/${r.user_id}/${dData.avatar}.png?size=256`;
          }
        }
      } catch (e) {
        console.error("Failed to fetch discord user:", e);
      }
      discordUsers.push(discordUser);
    }));

    // Fetch Last.fm Data
    let lastfmData = {
      playcount: 0,
      topArtists: [] as any[],
      recentTracks: [] as any[],
      topTracks: [] as any[],
      topAlbums: [] as any[]
    };
    let debugLogs: any[] = [];

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
        lastfmData.topArtists = [];
        
        for (const a of artistsList) {
          let imageUrl = a.image?.find((i: any) => i.size === "extralarge")?.["#text"] || null;
          
          // Last.fm's default generic star image hash
          if (imageUrl && imageUrl.includes("2a96cbd8b46e442fc41c2b86b821562f")) {
            imageUrl = null;
          }

          // Fetch from Deezer sequentially
          if (!imageUrl) {
            const imgRes = await getDeezerArtistImage(a.name);
            if (imgRes?.error) {
              debugLogs.push({ artist: a.name, error: imgRes.error });
            }
            imageUrl = imgRes?.url || null;
          }

          lastfmData.topArtists.push({
            name: a.name,
            playcount: a.playcount,
            url: a.url,
            image: imageUrl
          });
        }
      }

      if (!recentData.error && recentData.recenttracks?.track) {
        // Last.fm can return a single object or array
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
        const topTracks = Array.isArray(tracksData.toptracks.track) ? tracksData.toptracks.track : [tracksData.toptracks.track];
        lastfmData.topTracks = topTracks.map((t: any) => ({
          name: t.name,
          artist: t.artist?.name,
          playcount: t.playcount,
          url: t.url,
          image: t.image?.find((i: any) => i.size === "large")?.["#text"] || null
        }));
      }

      if (!albumsData.error && albumsData.topalbums?.album) {
        const topAlbums = Array.isArray(albumsData.topalbums.album) ? albumsData.topalbums.album : [albumsData.topalbums.album];
        
        lastfmData.topAlbums = [];
        for (const a of topAlbums) {
          let imageUrl = a.image?.find((i: any) => i.size === "extralarge")?.["#text"] || null;
          
          if (imageUrl && imageUrl.includes("2a96cbd8b46e442fc41c2b86b821562f")) {
            imageUrl = null;
          }

          lastfmData.topAlbums.push({
            name: a.name,
            artist: a.artist?.name,
            playcount: a.playcount,
            url: a.url,
            image: imageUrl
          });
        }
      }

    } catch (e) {
      console.error("Last.fm fetch error:", e);
      return NextResponse.json({ error: "Failed to fetch Last.fm data." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      users: discordUsers,
      stats: lastfmData,
      _debug: debugLogs
    });

  } catch (error) {
    console.error("Public profile error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
