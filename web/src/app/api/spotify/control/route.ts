import { NextResponse } from "next/server";
import { getSpotifyAccessToken, getUserIdFromRequest, spotifyFetch } from "@/lib/spotify";

type ActionTarget = {
  method: string;
  path: (body: any) => string;
  body?: (body: any) => string | undefined;
  validate?: (body: any) => string | null;
};

const ACTIONS: Record<string, ActionTarget> = {
  play: { method: "PUT", path: () => "/me/player/play" },
  pause: { method: "PUT", path: () => "/me/player/pause" },
  next: { method: "POST", path: () => "/me/player/next" },
  previous: { method: "POST", path: () => "/me/player/previous" },
  shuffle: {
    method: "PUT",
    path: (b) => `/me/player/shuffle?state=${b.state === true || b.state === "true"}`,
    validate: (b) => (b.state === undefined ? "Missing state (true/false)." : null),
  },
  repeat: {
    method: "PUT",
    path: (b) => `/me/player/repeat?state=${["track", "context", "off"].includes(b.state) ? b.state : "off"}`,
    validate: (b) =>
      ["track", "context", "off"].includes(b.state) ? null : "Missing state (track/context/off).",
  },
  volume: {
    method: "PUT",
    path: (b) => `/me/player/volume?volume_percent=${Math.max(0, Math.min(100, Math.round(Number(b.volume))))}`,
    validate: (b) =>
      Number.isFinite(Number(b.volume)) ? null : "Missing volume (0-100).",
  },
  seek: {
    method: "PUT",
    path: (b) => `/me/player/seek?position_ms=${Math.max(0, Math.round(Number(b.position_ms)))}`,
    validate: (b) =>
      Number.isFinite(Number(b.position_ms)) ? null : "Missing position_ms.",
  },
  transfer: {
    method: "PUT",
    path: () => "/me/player",
    body: (b) => JSON.stringify({ device_ids: [String(b.device_id)], play: b.play === true }),
    validate: (b) => (b.device_id ? null : "Missing device_id."),
  },
};

export async function POST(req: Request) {
  const myId = await getUserIdFromRequest(req);
  if (!myId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const target = ACTIONS[body?.action];
  if (!target) {
    return NextResponse.json(
      { error: "Unknown action. Use play, pause, next, previous, shuffle, repeat, volume, seek, transfer." },
      { status: 400 }
    );
  }
  if (target.validate) {
    const err = target.validate(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  const accessToken = await getSpotifyAccessToken(myId);
  if (!accessToken) return NextResponse.json({ is_playing: false, error: "not_linked" }, { status: 404 });

  try {
    const r = await spotifyFetch(accessToken, target.path(body), {
      method: target.method,
      ...(target.body ? { body: target.body(body) } : {}),
    });
    if (r.status === 204 || r.ok) return NextResponse.json({ success: true });
    if (r.status === 401) {
      // Token granted before control scopes existed. Re-linking fixes it.
      return NextResponse.json(
        { error: "Spotify didn't grant control permissions. Disconnect Spotify in Settings (or ,play in Discord) and link it again." },
        { status: 400 }
      );
    }
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
