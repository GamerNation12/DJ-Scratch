import { NextResponse } from "next/server";
import { getSpotifyAccessToken, getUserIdFromRequest, spotifyFetch } from "@/lib/spotify";

export const dynamic = "force-dynamic";

// Playback devices for the Spotify remote (player device picker + transfer).
export async function GET(req: Request) {
  const myId = await getUserIdFromRequest(req);
  if (!myId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken = await getSpotifyAccessToken(myId);
  if (!accessToken) return NextResponse.json({ error: "not_linked" }, { status: 404 });

  try {
    const r = await spotifyFetch(accessToken, "/me/player/devices");
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return NextResponse.json({ error: `Spotify error: ${r.status} ${text}`.trim() }, { status: 500 });
    }
    const data = await r.json();
    return NextResponse.json({
      devices: (data?.devices || []).map((d: any) => ({
        id: d?.id || null,
        name: d?.name || "Unknown device",
        type: d?.type || "",
        is_active: !!d?.is_active,
        volume_percent: typeof d?.volume_percent === "number" ? d.volume_percent : null,
      })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
