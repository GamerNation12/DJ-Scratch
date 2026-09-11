"use client";
import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { HeartHandshake, Search, ChevronLeft } from "lucide-react";
import { tasteLabel } from "@/lib/taste";

export default function TastePage() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const search = async () => {
    if (!a.trim() || !b.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({ a: a.trim(), b: b.trim() });
      const res = await fetch(`/api/tools/taste?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || data.error) setError(data.error || "Compare failed.");
      else setResult(data);
    } catch {
      setError("Compare failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden relative pb-32">
      <Navbar />
      <div className="fixed top-0 left-1/4 w-1/2 h-[500px] bg-pink-600/10 rounded-full blur-[160px] pointer-events-none z-0" />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 relative z-10 max-w-3xl animate-fade-in-up">
        <Link href="/tools" className="inline-flex items-center gap-1 text-zinc-500 hover:text-white text-sm mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" /> All tools
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-pink-300 to-rose-400 mb-3 flex items-center justify-center gap-3">
            <HeartHandshake className="w-9 h-9 md:w-11 md:h-11 text-pink-300" />
            Taste Compare
          </h1>
          <p className="text-zinc-400">Compatibility between any two Last.fm users. Bot: <span className="font-mono text-zinc-500">/taste</span></p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-5 sm:p-6 shadow-lg mb-6">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={a}
              onChange={(e) => setA(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="First Last.fm username"
              className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-pink-500/50"
            />
            <input
              value={b}
              onChange={(e) => setB(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Second Last.fm username"
              className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-pink-500/50"
            />
            <button
              onClick={search}
              disabled={loading || !a.trim() || !b.trim()}
              className="bg-pink-500/20 hover:bg-pink-500/30 disabled:opacity-50 text-pink-300 border border-pink-500/30 rounded-lg px-5 py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Search className="w-4 h-4" /> {loading ? "..." : "Compare"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300 text-center">{error}</div>
        )}

        {result && (
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-5 sm:p-6 shadow-lg">
            <div className="text-center mb-5">
              <p className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-pink-300 to-rose-400">{result.score}%</p>
              <p className="text-zinc-300 font-bold mt-1">{tasteLabel(result.score)}</p>
              <p className="text-zinc-500 text-sm mt-1 truncate">{result.a} × {result.b}</p>
            </div>
            {result.shared?.length > 0 ? (
              <div className="space-y-1.5">
                {result.shared.map((s: any) => (
                  <div key={s.name} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02]">
                    <span className="text-sm font-bold text-zinc-100 truncate flex-1">{s.name}</span>
                    <span className="text-xs font-mono text-zinc-500 shrink-0">{s.mine.toLocaleString()} · {s.theirs.toLocaleString()}</span>
                    <span className="text-xs font-mono text-pink-300 shrink-0 w-16 text-right">{s.combined.toLocaleString()}</span>
                  </div>
                ))}
                <p className="text-zinc-600 text-xs text-right pt-1">plays · plays · combined</p>
              </div>
            ) : (
              <p className="text-zinc-500 text-sm text-center">No shared artists in their top 50.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
