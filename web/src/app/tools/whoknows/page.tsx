"use client";
import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Crown, Search, ChevronLeft } from "lucide-react";

type Kind = "artist" | "track" | "album";

export default function WhoKnowsPage() {
  const [kind, setKind] = useState<Kind>("artist");
  const [artist, setArtist] = useState("");
  const [track, setTrack] = useState("");
  const [album, setAlbum] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const search = async () => {
    if (!artist.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({ kind, artist: artist.trim() });
      if (kind === "track") params.set("track", track.trim());
      if (kind === "album") params.set("album", album.trim());
      const res = await fetch(`/api/tools/whoknows?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Lookup failed.");
      } else if (!data.leaderboard?.length) {
        setError("Nobody on the bot listens to this yet.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  const title =
    result?.kind === "track" ? `${result.track} by ${result.artist}`
    : result?.kind === "album" ? `${result.album} by ${result.artist}`
    : result?.artist || "";

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden relative pb-32">
      <Navbar />
      <div className="fixed top-0 left-1/4 w-1/2 h-[500px] bg-amber-600/10 rounded-full blur-[160px] pointer-events-none z-0" />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 relative z-10 max-w-3xl animate-fade-in-up">
        <Link href="/tools" className="inline-flex items-center gap-1 text-zinc-500 hover:text-white text-sm mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" /> All tools
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-orange-400 mb-3 flex items-center justify-center gap-3">
            <Crown className="w-9 h-9 md:w-11 md:h-11 text-amber-300" />
            WhoKnows
          </h1>
          <p className="text-zinc-400">Top listeners across the whole bot. Bot: <span className="font-mono text-zinc-500">/globalwhoknows</span></p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-5 sm:p-6 shadow-lg mb-6">
          <div className="flex gap-2 mb-4">
            {(["artist", "track", "album"] as Kind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                  kind === k ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Artist (e.g. Taylor Swift)"
              className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
            />
            {kind !== "artist" && (
              <input
                value={kind === "track" ? track : album}
                onChange={(e) => (kind === "track" ? setTrack(e.target.value) : setAlbum(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder={kind === "track" ? "Track" : "Album"}
                className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
              />
            )}
            <button
              onClick={search}
              disabled={loading || !artist.trim()}
              className="bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-50 text-amber-300 border border-amber-500/30 rounded-lg px-5 py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Search className="w-4 h-4" /> {loading ? "..." : "Search"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300 text-center">{error}</div>
        )}

        {result && (
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-5 sm:p-6 shadow-lg">
            <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-white font-bold text-lg truncate">{title}</h2>
              <span className="text-zinc-500 text-xs font-mono shrink-0">{result.listeners} listener{result.listeners === 1 ? "" : "s"}</span>
            </div>
            <div className="space-y-2">
              {result.leaderboard.map((r: any, i: number) => (
                <div key={r.userId} className={`flex items-center gap-3 p-2.5 rounded-xl ${i === 0 ? "bg-amber-500/10 border border-amber-500/20" : "bg-white/[0.02] border border-transparent"}`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${i === 0 ? "bg-gradient-to-br from-yellow-300 to-yellow-600 text-black" : "bg-zinc-800 text-zinc-400"}`}>
                    {i === 0 ? <Crown className="w-3.5 h-3.5" /> : i + 1}
                  </span>
                  {r.avatar ? (
                    <img src={r.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500 shrink-0">
                      {(r.name || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-sm font-bold text-zinc-100 truncate flex-1">{r.name}</span>
                  <div className="hidden sm:block w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden shrink-0">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full" style={{ width: `${Math.max(4, r.share)}%` }} />
                  </div>
                  <span className="text-sm font-mono text-zinc-300 shrink-0">{r.plays.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
