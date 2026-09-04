import { NextResponse } from "next/server";
import { getSpotifyAccessToken, getUserIdFromRequest, spotifyFetch } from "@/lib/spotify";

export async function GET(req: Request) {
  const myId = await getUserIdFromRequest(req);
  if (!myId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const access_token = await getSpotifyAccessToken(myId);
    if (!access_token) {
      return NextResponse.json({ is_playing: false, error: "not_linked" });
    }

    const npRes = await spotifyFetch(access_token, "/me/player/currently-playing");

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

    // Liked state (best-effort: never fail the whole request over it).
    let is_liked = false;
    try {
      if (npData.item.id) {
        const likeRes = await spotifyFetch(
          access_token,
          `/me/tracks/contains?ids=${encodeURIComponent(npData.item.id)}`
        );
        if (likeRes.ok) {
          const arr = await likeRes.json();
          is_liked = Array.isArray(arr) ? !!arr[0] : false;
        }
      }
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      is_playing: npData.is_playing,
      song: npData.item.name,
      artist: npData.item.artists ? npData.item.artists.map((a: { name: string }) => a.name).join(", ") : "Unknown Artist",
      album: npData.item.album?.name || "",
      album_art: npData.item.album?.images?.[0]?.url || "",
      progress_ms: npData.progress_ms || 0,
      duration_ms: npData.item.duration_ms || 0,
      id: npData.item.id || null,
      uri: npData.item.uri || null,
      spotify_url: npData.item.external_urls?.spotify || null,
      device: npData.device?.name || null,
      is_liked,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Error";
    console.error(msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
