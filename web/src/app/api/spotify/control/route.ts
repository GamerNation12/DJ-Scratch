import { NextResponse } from "next/server";
import { getSpotifyAccessToken, getUserIdFromRequest, spotifyFetch } from "@/lib/spotify";

const ACTIONS: Record<string, { method: string; path: string }> = {
  play: { method: "PUT", path: "/me/player/play" },
  pause: { method: "PUT", path: "/me/player/pause" },
  next: { method: "POST", path: "/me/player/next" },
  previous: { method: "POST", path: "/me/player/previous" },
};

export async function POST(req: Request) {
  const myId = await getUserIdFromRequest(req);
  if (!myId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let action: string;
  try {
    action = (await req.json()).action;
  } catch {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const target = ACTIONS[action];
  if (!target) {
    return NextResponse.json({ error: "Unknown action. Use play, pause, next, previous." }, { status: 400 });
  }

  const accessToken = await getSpotifyAccessToken(myId);
  if (!accessToken) return NextResponse.json({ is_playing: false, error: "not_linked" }, { status: 404 });

  try {
    const r = await spotifyFetch(accessToken, target.path, { method: target.method });
    if (r.status === 204 || r.ok) return NextResponse.json({ success: true });
    if (r.status === 404) {
      return NextResponse.json(
        { error: "No active Spotify device. Open Spotify on your phone or computer first." },
        { status: 400 }
      );
    }
    if (r.status === 403) {
      return NextResponse.json(
        { error: "Spotify Premium is required for remote control." },
        { status: 400 }
      );
    }
    const text = await r.text().catch(() => "");
    return NextResponse.json({ error: `Spotify error: ${r.status} ${text}`.trim() }, { status: 500 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
