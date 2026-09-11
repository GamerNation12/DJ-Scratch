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

    const suggestions = raw.slice(0, 12).map((x: any) => {
      const imgs = Array.isArray(x.image) ? x.image : [];
      let image = imgs.map((i: any) => i?.["#text"]).find((u: string) => u) || undefined;
      // Last.fm's default "no image" star placeholder — treat as no image so
      // the UI falls back to the initial-letter avatar instead of a white box.
      if (image && (image.includes("2a96cbd8b46e442fc41c2b86b821562f") || image.includes("36bb9b7f5efbb0bb01f454bb86a0e603"))) {
        image = undefined;
      }
      return {
        name: x.name,
        artist: typeof x.artist === "string" ? x.artist : x.artist?.name || undefined,
        listeners: x.listeners ? parseInt(x.listeners, 10) : undefined,
        image,
      };
    }).filter((s: any) => s.name);

    // De-dupe by name, keep order — then rank exact/prefix matches first.
    const seen = new Set<string>();
    const ql = q.toLowerCase();
    const unique = suggestions
      .filter((s: any) => {
        const k = `${s.name}::${s.artist || ""}`.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((x: any, y: any) => {
        const rank = (s: any) => {
          const n = (s.name || "").toLowerCase();
          if (n === ql) return 0;
          if (n.startsWith(ql)) return 1;
          return 2;
        };
        const r = rank(x) - rank(y);
        if (r !== 0) return r;
        return (y.listeners || 0) - (x.listeners || 0);
      })
      .slice(0, 8);

    return NextResponse.json({ success: true, suggestions: unique });
  } catch (error) {
    console.error("Autocomplete error:", error);
    return NextResponse.json({ success: true, suggestions: [] });
  }
}
