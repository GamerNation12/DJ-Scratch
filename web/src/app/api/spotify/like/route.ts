import { NextResponse } from "next/server";
import { getSpotifyAccessToken, getUserIdFromRequest, spotifyFetch } from "@/lib/spotify";

// Body: { id: "<spotify track id>", action: "like" | "unlike" }
export async function POST(req: Request) {
  const myId = await getUserIdFromRequest(req);
  if (!myId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let id: string;
  let action: string;
  try {
    ({ id, action } = await req.json());
  } catch {
    return NextResponse.json({ error: "Missing id/action" }, { status: 400 });
  }
  if (!id || (action !== "like" && action !== "unlike")) {
    return NextResponse.json({ error: 'Send { id, action: "like" | "unlike" }' }, { status: 400 });
  }

  const accessToken = await getSpotifyAccessToken(myId);
  if (!accessToken) return NextResponse.json({ error: "not_linked" }, { status: 404 });

  try {
    const r = await spotifyFetch(accessToken, `/me/tracks?ids=${encodeURIComponent(id)}`, {
      method: action === "like" ? "PUT" : "DELETE",
    });
    if (r.status === 200 || r.status === 204 || r.ok) {
      return NextResponse.json({ success: true, liked: action === "like" });
    }
    const text = await r.text().catch(() => "");
    return NextResponse.json({ error: `Spotify error: ${r.status} ${text}`.trim() }, { status: 500 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
