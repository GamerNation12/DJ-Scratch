"use client";
import { fetchApi } from "@/lib/fetchApi";
import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { TrendingUp, MessageSquare, Music, Trophy } from "lucide-react";

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"scrobbles" | "artists" | "chatters">("scrobbles");

  useEffect(() => {
    Promise.all([
      fetchApi("/api/leaderboard").then(res => res.json()),
      fetchApi("/api/stats").then(res => res.json())
    ])
    .then(([lbData, statsData]) => {
      if (lbData.error) setError(lbData.error);
      else setLeaderboard(lbData.leaderboard || []);
      setStats(statsData);
    })
    .catch(() => setError("Failed to load global stats."))
    .finally(() => setLoading(false));
  }, []);

  const getRankBadge = (index: number) => {
    switch (index) {
      case 0: return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 flex items-center justify-center text-black font-black text-sm shadow-[0_0_15px_rgba(250,204,21,0.5)]">1</div>;
      case 1: return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-500 flex items-center justify-center text-black font-black text-sm shadow-[0_0_15px_rgba(161,161,170,0.5)]">2</div>;
      case 2: return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white font-black text-sm shadow-[0_0_15px_rgba(217,119,6,0.5)]">3</div>;
      default: return <div className="w-8 h-8 rounded-full bg-zinc-800/80 border border-white/10 flex items-center justify-center text-zinc-400 font-bold text-sm">{index + 1}</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden relative pb-32">
      <Navbar />
      
      {/* Background Blurs */}
      <div className="fixed top-0 left-1/4 w-1/2 h-[500px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-1/4 w-1/3 h-[400px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none z-0" />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 relative z-10 max-w-4xl animate-fade-in-up">
        
        {/* HEADER */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 mb-4 drop-shadow-sm flex items-center justify-center gap-4">
            <TrendingUp className="w-10 h-10 md:w-14 md:h-14 text-indigo-400" />
            Global Hub
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl">
            Server-wide statistics and leaderboards for DJ Scratch.
          </p>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex items-center justify-center mb-12">
          <div className="bg-zinc-900/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 flex flex-col sm:flex-row w-full sm:w-auto gap-2">
            <button 
              onClick={() => setActiveTab("scrobbles")}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'scrobbles' ? 'bg-indigo-500/20 text-indigo-300 shadow-lg border border-indigo-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            >
              <Trophy className="w-4 h-4" /> Top Scrobbles
            </button>
            <button 
              onClick={() => setActiveTab("artists")}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'artists' ? 'bg-green-500/20 text-green-300 shadow-lg border border-green-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            >
              <Music className="w-4 h-4" /> Top Artists
            </button>
            <button 
              onClick={() => setActiveTab("chatters")}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeTab === 'chatters' ? 'bg-blue-500/20 text-blue-300 shadow-lg border border-blue-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            >
              <MessageSquare className="w-4 h-4" /> Active Chatters
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-center p-8 text-zinc-500 bg-zinc-900/30 rounded-3xl border border-white/5 border-dashed">
            {error}
          </div>
        ) : (
          <div className="animate-fade-in">
            {/* SCROBBLES TAB */}
            {activeTab === "scrobbles" && (
              leaderboard.length === 0 ? (
                <div className="text-center p-8 text-zinc-500 bg-zinc-900/30 rounded-3xl border border-white/5 border-dashed">
                  No users have data available yet!
                </div>
              ) : (
                <div className="space-y-4">
                  {leaderboard.map((user, idx) => {
                    const isTop3 = idx < 3;
                    return (
                      <div 
                        key={user.userId}
                        className={`relative overflow-hidden flex items-center justify-between p-4 sm:p-6 rounded-2xl transition-all duration-300 group
                          ${isTop3 
                            ? 'bg-zinc-900/80 border border-white/10 shadow-xl hover:shadow-[0_0_25px_rgba(99,102,241,0.2)]' 
                            : 'bg-zinc-900/30 border border-white/5 hover:bg-zinc-900/50 hover:border-white/10'
                          }
                        `}
                      >
                        {idx === 0 && <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-transparent pointer-events-none" />}
                        
                        <div className="flex items-center gap-4 sm:gap-6 relative z-10">
                          <div className="shrink-0">
                            {getRankBadge(idx)}
                          </div>
                          
                          <Link href={`/${user.username}`} className="flex items-center gap-3 sm:gap-4 group-hover:opacity-80 transition-opacity">
                            <img 
                              src={user.avatar || "/logo.png"} 
                              alt="Avatar" 
                              className={`rounded-full object-cover shadow-md ${isTop3 ? 'w-12 h-12 sm:w-16 sm:h-16 border-2 border-white/10' : 'w-10 h-10 border border-white/5'}`}
                            />
                            <div>
                              <div className={`font-bold text-white transition-colors ${isTop3 ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`}>
                                {user.username}
                              </div>
                              <div className="text-xs text-zinc-500 font-medium truncate max-w-[150px] sm:max-w-xs">
                                {user.lastfm_username}
                              </div>
                            </div>
                          </Link>
                        </div>
                        
                        <div className="relative z-10 text-right shrink-0 pl-4">
                          <div className={`font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r ${isTop3 ? 'from-indigo-400 to-purple-400 text-2xl sm:text-4xl' : 'from-zinc-300 to-zinc-500 text-xl sm:text-2xl'}`}>
                            {user.playcount.toLocaleString()}
                          </div>
                          <div className="text-[10px] sm:text-xs text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                            Scrobbles
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* ARTISTS TAB */}
            {activeTab === "artists" && (
              <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6 sm:p-8">
                <div className="space-y-4">
                  {stats?.topArtists?.map((a: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-zinc-800/30 rounded-xl hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="text-zinc-500 font-bold w-6">{idx + 1}.</span>
                        <span className="font-semibold text-lg">{a.artist_name}</span>
                      </div>
                      <span className="text-green-400 font-bold text-xl">{a.playcount} <span className="text-xs text-zinc-500 font-normal">plays</span></span>
                    </div>
                  ))}
                  {!stats?.topArtists?.length && (
                    <div className="text-center text-zinc-500 py-8">No artist data available.</div>
                  )}
                </div>
              </div>
            )}

            {/* CHATTERS TAB */}
            {activeTab === "chatters" && (
              <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6 sm:p-8">
                <div className="space-y-4">
                  {stats?.topChatters?.map((c: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-zinc-800/30 rounded-xl hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="text-zinc-500 font-bold w-6">{idx + 1}.</span>
                        <span className="font-semibold text-lg">{c.username}</span>
                      </div>
                      <span className="text-blue-400 font-bold text-xl">{c.message_count} <span className="text-xs text-zinc-500 font-normal">msgs</span></span>
                    </div>
                  ))}
                  {!stats?.topChatters?.length && (
                    <div className="text-center text-zinc-500 py-8">No chatter data available.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
