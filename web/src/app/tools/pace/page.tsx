"use client";
import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Gauge, Search, ChevronLeft, Flag, Rocket } from "lucide-react";

export default function PacePage() {
  const [user, setUser] = useState("");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const search = async () => {
    if (!user.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({ user: user.trim() });
      const g = parseInt(goal.replace(/,/g, ""), 10);
      if (Number.isFinite(g) && g > 0) params.set("goal", String(g));
      const res = await fetch(`/api/tools/pace?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || data.error) setError(data.error || "Lookup failed.");
      else setResult(data);
    } catch {
      setError("Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  const pct = result ? Math.min(100, (result.total / result.nextMilestone) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden relative pb-32">
      <Navbar />
      <div className="fixed top-0 left-1/4 w-1/2 h-[500px] bg-emerald-600/10 rounded-full blur-[160px] pointer-events-none z-0" />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 relative z-10 max-w-3xl animate-fade-in-up">
        <Link href="/tools" className="inline-flex items-center gap-1 text-zinc-500 hover:text-white text-sm mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" /> All tools
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-teal-400 mb-3 flex items-center justify-center gap-3">
            <Gauge className="w-9 h-9 md:w-11 md:h-11 text-emerald-300" />
            Pace
          </h1>
          <p className="text-zinc-400">Milestones and ETAs for any Last.fm username. Bot: <span className="font-mono text-zinc-500">/pace · /milestone</span></p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-5 sm:p-6 shadow-lg mb-6">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Last.fm username"
              className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
            />
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Goal (optional, e.g. 50000)"
              inputMode="numeric"
              className="sm:w-52 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
            />
            <button
              onClick={search}
              disabled={loading || !user.trim()}
              className="bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50 text-emerald-300 border border-emerald-500/30 rounded-lg px-5 py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Search className="w-4 h-4" /> {loading ? "..." : "Check"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300 text-center">{error}</div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-white">{result.total.toLocaleString()}</p>
                <p className="text-zinc-500 text-xs mt-1">total plays</p>
              </div>
              <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-white">{result.dailyRate}<span className="text-sm text-zinc-500">/day</span></p>
                <p className="text-zinc-500 text-xs mt-1">current rate</p>
              </div>
              <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-emerald-300">{result.nextMilestone.toLocaleString()}</p>
                <p className="text-zinc-500 text-xs mt-1">next milestone</p>
              </div>
            </div>

            <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Flag className="w-4 h-4 text-emerald-300" />
                <span className="text-sm font-bold text-white">
                  {result.next.reached ? "Milestone reached!" : `${(result.nextMilestone - result.total).toLocaleString()} to go · ETA ${result.next.date} (~${result.next.days}d)`}
                </span>
              </div>
              <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-zinc-600 text-xs font-mono mt-2">{pct.toFixed(1)}% of the way from {result.prevMilestone.toLocaleString()}</p>
            </div>

            {result.goal && (
              <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-lg flex items-center gap-3">
                <Rocket className="w-5 h-5 text-indigo-300 shrink-0" />
                <p className="text-sm text-zinc-300">
                  Goal <span className="font-black text-white">{result.goal.toLocaleString()}</span>:{" "}
                  {result.goalEta.reached ? (
                    <span className="text-emerald-300 font-bold">already smashed it.</span>
                  ) : (
                    <>ETA <span className="font-bold text-white">{result.goalEta.date}</span> <span className="text-zinc-500">(~{result.goalEta.days} days)</span></>
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
