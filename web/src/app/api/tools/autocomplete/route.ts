import { NextResponse } from "next/server";

const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "eee299142ac5fe73e5eb5dcd1c29bcae";

// Last.fm's default "no image" star placeholders.
const PLACEHOLDER_HASHES = ["2a96cbd8b46e442fc41c2b86b821562f", "36bb9b7f5efbb0bb01f454bb86a0e603"];
const isPlaceholder = (u?: string) => !u || PLACEHOLDER_HASHES.some((h) => u.includes(h));

// Deezer artist picture (same source the bot uses for artist images).
async function deezerArtistImage(name: string): Promise<string | undefined> {
  try {
    const res = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}`, {
      signal: AbortSignal.timeout(2500),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data?.data?.[0]?.picture_medium || data?.data?.[0]?.picture || undefined;
  } catch {
    return undefined;
  }
}

// Deezer track cover.
async function deezerTrackImage(artist: string, name: string): Promise<string | undefined> {
  try {
    const res = await fetch(`https://api.deezer.com/search/track?q=${encodeURIComponent(`${artist} ${name}`)}`, {
      signal: AbortSignal.timeout(2500),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    const album = data?.data?.[0]?.album;
    return album?.cover_medium || album?.cover || undefined;
  } catch {
    return undefined;
  }
}

// iTunes Search API (no key needed, same as the bot's artwork chain).
async function itunesArtwork(term: string, entity: "album" | "song"): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=${entity}&limit=1`,
      { signal: AbortSignal.timeout(2500), next: { revalidate: 86400 } }
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    const url = data?.results?.[0]?.artworkUrl100;
    return url ? url.replace("100x100bb", "300x300bb") : undefined;
  } catch {
    return undefined;
  }
}

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
      // Last.fm's default "no image" star placeholder counts as no image.
      if (isPlaceholder(image)) image = undefined;
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

    // Fill imageless suggestions via Deezer -> iTunes (parallel, cached 24h).
    await Promise.all(
      unique.map(async (s: any) => {
        if (s.image) return;
        if (kind === "artist") {
          s.image =
            (await deezerArtistImage(s.name)) ||
            (await itunesArtwork(s.name, "album")) ||
            undefined;
        } else {
          const term = s.artist ? `${s.artist} ${s.name}` : s.name;
          s.image =
            (await itunesArtwork(term, kind === "track" ? "song" : "album")) ||
            (s.artist ? await deezerTrackImage(s.artist, s.name) : undefined) ||
            undefined;
        }
      })
    );

    return NextResponse.json({ success: true, suggestions: unique });
  } catch (error) {
    console.error("Autocomplete error:", error);
    return NextResponse.json({ success: true, suggestions: [] });
  }
}
