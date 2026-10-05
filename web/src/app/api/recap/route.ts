import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";

const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "eee299142ac5fe73e5eb5dcd1c29bcae";

export const revalidate = 300; // Recaps change slowly; cache 5 min.

const PLACEHOLDER_HASHES = ["2a96cbd8b46e442fc41c2b86b821562f", "4128a6eb", "36bb9b7f5efbb0bb01f454bb86a0e603"];

function cleanImg(url: string | null | undefined): string | null {
  if (!url) return null;
  if (PLACEHOLDER_HASHES.some((h) => url.includes(h))) return null;
  return url;
}

function bestImg(item: any): string | null {
  try {
    const imgs = item?.image;
    if (Array.isArray(imgs)) {
      for (let i = imgs.length - 1; i >= 0; i--) {
        const u = imgs[i]?.["#text"];
        const c = cleanImg(u);
        if (c) return c;
      }
    }
  } catch { /* ignore */ }
  return null;
}

function asList(v: any): any[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawPeriod = (url.searchParams.get("period") || "week").toLowerCase();
  const period: "week" | "month" = rawPeriod.startsWith("month") || rawPeriod === "1month" || rawPeriod === "30day" ? "month" : "week";
  const days = period === "month" ? 30 : 7;
  const apiPeriod = period === "month" ? "1month" : "7day";

  // Auth is optional: ?user=<name|id> views anyone's public recap,
  // otherwise the Bearer token's own recap (private profiles allowed).
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1] || null;
  const authed = token ? await verifyToken(token) : null;
  const authedId = (authed as any)?.id ? String((authed as any).id) : null;
  const wantUser = (url.searchParams.get("user") || "").trim();

  try {
    let targetId: string | null = null;
    let lastfmUsername: string | null = null;
    let dataSource = "combined";

    if (wantUser) {
      const key = decodeURIComponent(wantUser);
      let rows: any[] = [];
      if (/^\d{5,25}$/.test(key)) {
        rows = await sql`
          SELECT user_id, lastfm_username, private_mode, data_source, is_banned, ban_reason
          FROM user_settings WHERE user_id = ${key}`;
      } else {
        rows = await sql`
          SELECT user_id, lastfm_username, private_mode, data_source, is_banned, ban_reason
          FROM user_settings
          WHERE REPLACE(REPLACE(discord_username, ' ', ''), '-', '') ILIKE REPLACE(REPLACE(${key}, ' ', ''), '-', '')
             OR REPLACE(REPLACE(lastfm_username, ' ', ''), '-', '') ILIKE REPLACE(REPLACE(${key}, ' ', ''), '-', '')
             OR REPLACE(REPLACE(display_name, ' ', ''), '-', '') ILIKE REPLACE(REPLACE(${key}, ' ', ''), '-', '')`;
      }
      if (rows.length === 0) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }
      const row = rows[0];
      if (row.is_banned) {
        return NextResponse.json({ error: "This user is banned." }, { status: 403 });
      }
      if (row.private_mode && authedId !== String(row.user_id)) {
        return NextResponse.json({ error: "This profile is private." }, { status: 403 });
      }
      targetId = String(row.user_id);
      lastfmUsername = row.lastfm_username;
      dataSource = row.data_source || "combined";
    } else {
      if (!authedId) {
        return NextResponse.json({ error: "Unauthorized. Pass ?user=<name> or a Bearer token." }, { status: 401 });
      }
      const rows = await sql`
        SELECT user_id, lastfm_username, data_source FROM user_settings WHERE user_id = ${authedId}`;
      if (rows.length === 0 || (!rows[0].lastfm_username)) {
        // Import-only users can still get a recap from local listens.
        if (rows.length > 0) {
          targetId = String(rows[0].user_id);
          lastfmUsername = rows[0].lastfm_username || null;
          dataSource = rows[0].data_source || "combined";
        } else {
          return NextResponse.json({ error: "Link Last.fm first — the recap shows your stats!" }, { status: 404 });
        }
      } else {
        targetId = String(rows[0].user_id);
        lastfmUsername = rows[0].lastfm_username;
        dataSource = rows[0].data_source || "combined";
      }
    }

    if (!targetId) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const useFm = !!lastfmUsername && dataSource !== "imported_only";
    const useIm = dataSource !== "lastfm_only";

    // ---- Last.fm ----
    let fmArtists: any[] = [];
    let fmTracks: any[] = [];
    let fmAlbums: any[] = [];
    let fmOverallNames = new Set<string>();
    let fmTotal = 0;
    let fmCapped = false;

    if (useFm && lastfmUsername) {
      const u = encodeURIComponent(lastfmUsername);
      try {
        const [artRes, trkRes, albRes, ovRes] = await Promise.all([
          fetch(`http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${u}&api_key=${LASTFM_API_KEY}&format=json&period=${apiPeriod}&limit=5`),
          fetch(`http://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${u}&api_key=${LASTFM_API_KEY}&format=json&period=${apiPeriod}&limit=5`),
          fetch(`http://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${u}&api_key=${LASTFM_API_KEY}&format=json&period=${apiPeriod}&limit=3`),
          fetch(`http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${u}&api_key=${LASTFM_API_KEY}&format=json&period=overall&limit=50`),
        ]);
        const [art, trk, alb, ov] = await Promise.all([artRes.json().catch(() => null), trkRes.json().catch(() => null), albRes.json().catch(() => null), ovRes.json().catch(() => null)]);
        fmArtists = asList(art?.topartists?.artist).slice(0, 5).map((a: any) => ({
          name: a?.name || "Unknown", playcount: parseInt(a?.playcount || "0", 10) || 0, url: a?.url || null, image: bestImg(a),
        }));
        fmTracks = asList(trk?.toptracks?.track).slice(0, 5).map((t: any) => ({
          name: t?.name || "Unknown", artist: t?.artist?.name || "Unknown",
          playcount: parseInt(t?.playcount || "0", 10) || 0, url: t?.url || null, image: bestImg(t),
        }));
        fmAlbums = asList(alb?.topalbums?.album).slice(0, 3).map((b: any) => ({
          name: b?.name || "Unknown", artist: b?.artist?.name || "Unknown",
          playcount: parseInt(b?.playcount || "0", 10) || 0, url: b?.url || null, image: bestImg(b),
        }));
        for (const a of asList(ov?.topartists?.artist)) {
          if (a?.name) fmOverallNames.add(String(a.name).toLowerCase());
        }
      } catch { /* Last.fm partial failure -> fall through to imports */ }

      // Window total: page recents (same approach as the Discord recap).
      try {
        const cutoff = Date.now() / 1000 - days * 86400;
        for (let page = 1; page <= 5; page++) {
          const r = await fetch(
            `http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${u}&api_key=${LASTFM_API_KEY}&format=json&limit=200&page=${page}`
          );
          const d = await r.json().catch(() => null);
          const items = asList(d?.recenttracks?.track);
          if (items.length === 0) break;
          let oldest: number | null = null;
          for (const t of items) {
            if (t?.["@attr"]?.nowplaying === "true") continue;
            const uts = parseInt(t?.date?.uts || "0", 10);
            if (!Number.isFinite(uts) || uts <= 0) continue;
            if (oldest === null || uts < oldest) oldest = uts;
            if (uts >= cutoff) fmTotal++;
          }
          if (page === 5) fmCapped = true;
          if (oldest !== null && oldest < cutoff) break;
        }
      } catch { /* total stays best-effort */ }
    }

    // ---- Imported (DB) ----
    let imTotal = 0;
    let imArtists: any[] = [];
    let imTracks: any[] = [];
    let imAlbums: any[] = [];
    let imOverallNames = new Set<string>();
    if (useIm) {
      try {
        const cutoff = new Date(Date.now() - days * 86400000);
        const [cnt, arts, trks, albs, overall] = await Promise.all([
          sql`SELECT COUNT(*) as count FROM listens WHERE user_id = ${targetId} AND played_at >= ${cutoff} AND COALESCE(source,'import') != 'lastfm'`,
          sql`SELECT t.artist_name, COUNT(*) as playcount FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id = ${targetId} AND l.played_at >= ${cutoff} AND COALESCE(l.source,'import') != 'lastfm' GROUP BY t.artist_name ORDER BY playcount DESC LIMIT 5`,
          sql`SELECT t.track_name, t.artist_name, COUNT(*) as playcount FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id = ${targetId} AND l.played_at >= ${cutoff} AND COALESCE(l.source,'import') != 'lastfm' GROUP BY t.track_name, t.artist_name ORDER BY playcount DESC LIMIT 5`,
          sql`SELECT t.album_name, t.artist_name, COUNT(*) as playcount FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id = ${targetId} AND l.played_at >= ${cutoff} AND t.album_name IS NOT NULL AND t.album_name != '' AND COALESCE(l.source,'import') != 'lastfm' GROUP BY t.album_name, t.artist_name ORDER BY playcount DESC LIMIT 3`,
          sql`SELECT t.artist_name FROM listens l JOIN tracks t ON l.track_id = t.id WHERE l.user_id = ${targetId} AND COALESCE(l.source,'import') != 'lastfm' GROUP BY t.artist_name ORDER BY COUNT(*) DESC LIMIT 50`,
        ]);
        imTotal = parseInt((cnt as any[])[0]?.count || "0", 10) || 0;
        imArtists = (arts as any[]).map((r) => ({ name: r.artist_name, playcount: parseInt(r.playcount, 10) || 0, url: null, image: null }));
        imTracks = (trks as any[]).map((r) => ({ name: r.track_name, artist: r.artist_name, playcount: parseInt(r.playcount, 10) || 0, url: null, image: null }));
        imAlbums = (albs as any[]).map((r) => ({ name: r.album_name, artist: r.artist_name, playcount: parseInt(r.playcount, 10) || 0, url: null, image: null }));
        for (const r of overall as any[]) {
          if ((r as any)?.artist_name) imOverallNames.add(String((r as any).artist_name).toLowerCase());
        }
      } catch { /* imports best-effort */ }
    }

    // ---- Merge (period tops: max, consistent with /api/u window stats) ----
    function mergeArtists(a: any[], b: any[]) {
      const m = new Map<string, any>();
      for (const x of a) m.set(String(x.name).toLowerCase(), { ...x });
      for (const x of b) {
        const k = String(x.name).toLowerCase();
        if (m.has(k)) {
          const cur = m.get(k);
          cur.playcount = Math.max(cur.playcount, x.playcount);
          if (!cur.image && x.image) cur.image = x.image;
          if (!cur.url && x.url) cur.url = x.url;
        } else m.set(k, { ...x });
      }
      return [...m.values()].sort((x, y) => y.playcount - x.playcount).slice(0, 5);
    }
    function mergeTracks(a: any[], b: any[]) {
      const m = new Map<string, any>();
      for (const x of a) m.set(`${String(x.name).toLowerCase()}|${String(x.artist).toLowerCase()}`, { ...x });
      for (const x of b) {
        const k = `${String(x.name).toLowerCase()}|${String(x.artist).toLowerCase()}`;
        if (m.has(k)) {
          const cur = m.get(k);
          cur.playcount = Math.max(cur.playcount, x.playcount);
          if (!cur.image && x.image) cur.image = x.image;
          if (!cur.url && x.url) cur.url = x.url;
        } else m.set(k, { ...x });
      }
      return [...m.values()].sort((x, y) => y.playcount - x.playcount).slice(0, 5);
    }
    function mergeAlbums(a: any[], b: any[]) {
      const m = new Map<string, any>();
      for (const x of a) m.set(`${String(x.name).toLowerCase()}|${String(x.artist).toLowerCase()}`, { ...x });
      for (const x of b) {
        const k = `${String(x.name).toLowerCase()}|${String(x.artist).toLowerCase()}`;
        if (m.has(k)) {
          const cur = m.get(k);
          cur.playcount = Math.max(cur.playcount, x.playcount);
          if (!cur.image && x.image) cur.image = x.image;
          if (!cur.url && x.url) cur.url = x.url;
        } else m.set(k, { ...x });
      }
      return [...m.values()].sort((x, y) => y.playcount - x.playcount).slice(0, 3);
    }

    const topArtists = dataSource === "imported_only" ? imArtists : dataSource === "lastfm_only" ? fmArtists : mergeArtists(fmArtists, imArtists);
    const topTracks = dataSource === "imported_only" ? imTracks : dataSource === "lastfm_only" ? fmTracks : mergeTracks(fmTracks, imTracks);
    const topAlbums = dataSource === "imported_only" ? imAlbums : dataSource === "lastfm_only" ? fmAlbums : mergeAlbums(fmAlbums, imAlbums);
    const total = dataSource === "imported_only" ? imTotal : dataSource === "lastfm_only" ? fmTotal : Math.max(fmTotal, imTotal);

    const known = new Set([...fmOverallNames, ...imOverallNames]);
    const discoveries = topArtists.map((a) => a.name).filter((n) => n && !known.has(String(n).toLowerCase())).slice(0, 5);

    if (topArtists.length === 0 && topTracks.length === 0) {
      return NextResponse.json({ error: `No plays in the last ${period} — go listen to something first!` }, { status: 404 });
    }

    const now = new Date();
    const start = new Date(now.getTime() - days * 86400000);
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const label = `${fmt(start)} – ${fmt(now)}, ${now.getFullYear()}`;
    const title = period === "month" ? "YOUR MONTH IN MUSIC" : "YOUR WEEK IN MUSIC";

    return NextResponse.json({
      period, title, label, total, capped: fmCapped,
      topArtists, topTracks, topAlbums, discoveries,
      dataSource,
    });
  } catch (e) {
    console.error("Recap API error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
