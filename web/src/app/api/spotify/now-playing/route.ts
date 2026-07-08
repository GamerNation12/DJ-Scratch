import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myId = (user as any).id;

  try {
    // 1. Get refresh token from DB
    const res = await sql`SELECT spotify_refresh_token FROM user_settings WHERE user_id = ${myId}`;
    if (res.length === 0 || !res[0].spotify_refresh_token) {
      return NextResponse.json({ is_playing: false, error: "not_linked" });
    }
    
    const refresh_token = res[0].spotify_refresh_token;

    // 2. Fetch new access token
    const client_id = process.env.SPOTIFY_CLIENT_ID;
    const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
    
    const auth_str = Buffer.from(`${client_id}:${client_secret}`).toString("base64");
    
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth_str}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refresh_token
      })
    });
    
    if (!tokenRes.ok) return NextResponse.json({ error: "Failed to refresh token" }, { status: 500 });
    
    const tokenData = await tokenRes.json();
    const access_token = tokenData.access_token;
    
    // 3. Fetch currently playing
    const npRes = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: {
        "Authorization": `Bearer ${access_token}`
      }
    });
    
    if (npRes.status === 204) {
      return NextResponse.json({ is_playing: false });
    }
    if (!npRes.ok) {
      const text = await npRes.text();
      return NextResponse.json({ error: `Spotify API error: ${npRes.status} ${text}` }, { status: 500 });
    }
    
    const npData = await npRes.json();
    
    if (!npData.item) {
      return NextResponse.json({ is_playing: false });
    }
    
    return NextResponse.json({
      is_playing: npData.is_playing,
      song: npData.item.name,
      artist: npData.item.artists ? npData.item.artists.map((a: any) => a.name).join(", ") : "Unknown Artist",
      album_art: npData.item.album?.images?.[0]?.url || "",
      progress_ms: npData.progress_ms || 0,
      duration_ms: npData.item.duration_ms || 0
    });
    
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal Error", stack: err.stack }, { status: 500 });
  }
}
