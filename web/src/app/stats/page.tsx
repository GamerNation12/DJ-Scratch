"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { TrendingUp, MessageSquare, Music } from "lucide-react";

export default function StatsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans overflow-x-hidden relative pb-32">
      <Navbar />
      
      <div className="fixed top-0 left-1/4 w-1/2 h-[500px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none z-0" />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 relative z-10 max-w-6xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 mb-4 flex items-center justify-center gap-4">
            <TrendingUp className="w-12 h-12 text-indigo-400" />
            Global Stats
          </h1>
          <p className="text-zinc-400 text-lg">Platform-wide statistics for DJ Scratch.</p>
        </div>

        {loading ? (
          <div className="flex justify-center"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Top Artists */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6 sm:p-8">
              <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
                <Music className="w-6 h-6 text-green-400" />
                Top Artists
              </h2>
              <div className="space-y-4">
                {stats.topArtists?.map((a: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-zinc-800/30 rounded-xl hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-500 font-bold w-6">{idx + 1}.</span>
                      <span className="font-semibold">{a.artist_name}</span>
                    </div>
                    <span className="text-indigo-400 font-bold">{a.playcount} <span className="text-xs text-zinc-500 font-normal">plays</span></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Chatters */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6 sm:p-8">
              <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
                <MessageSquare className="w-6 h-6 text-blue-400" />
                Most Active Chatters
              </h2>
              <div className="space-y-4">
                {stats.topChatters?.map((c: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-zinc-800/30 rounded-xl hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-500 font-bold w-6">{idx + 1}.</span>
                      <span className="font-semibold">{c.username}</span>
                    </div>
                    <span className="text-indigo-400 font-bold">{c.message_count} <span className="text-xs text-zinc-500 font-normal">msgs</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
