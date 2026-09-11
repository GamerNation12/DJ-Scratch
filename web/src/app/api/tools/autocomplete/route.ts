import { NextResponse } from "next/server";

const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "eee299142ac5fe73e5eb5dcd1c29bcae";

// Suggest backend for the Tools inputs (.fmbot-style autocomplete):
// /api/tools/autocomplete?kind=artist|track|album&q=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = (searchParams.get("kind") || "artist").toLowerCase();
  const q = (searchParams.get("q") || "").trim().slice(0, 80);

  if (!["artist", "track", "album"].includes(kind)) {
    return NextResponse.json({ error: "kind must be artist, track or album" }, { status: 400 });
  }
  if (q.length < 2) {
    return NextResponse.json({ success: true, suggestions: [] });
  }

  try {
    const param = kind === "artist" ? "artist" : kind;
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=${kind}.search&${param}=${encodeURIComponent(q)}&api_key=${LASTFM_API_KEY}&format=json&limit=8`
    );
    const data = await res.json();

    let raw: any[] = [];
    if (kind === "artist") raw = data?.results?.artistmatches?.artist || [];
    else if (kind === "track") raw = data?.results?.trackmatches?.track || [];
    else raw = data?.results?.albummatches?.album || [];
    if (!Array.isArray(raw)) raw = [raw];

    const suggestions = raw.slice(0, 8).map((x: any) => ({
      name: x.name,
      artist: typeof x.artist === "string" ? x.artist : x.artist?.name || undefined,
      listeners: x.listeners ? parseInt(x.listeners, 10) : undefined,
    })).filter((s: any) => s.name);

    // De-dupe by name, keep order.
    const seen = new Set<string>();
    const unique = suggestions.filter((s: any) => {
      const k = `${s.name}::${s.artist || ""}`.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    return NextResponse.json({ success: true, suggestions: unique });
  } catch (error) {
    console.error("Autocomplete error:", error);
    return NextResponse.json({ success: true, suggestions: [] });
  }
}
