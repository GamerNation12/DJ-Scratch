"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchApi } from "@/lib/fetchApi";

export default function PublicProfileClient({ id }: { id: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("No user specified.");
      setLoading(false);
      return;
    }

    fetchApi(`/api/u/${id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
          } else {
            setProfile(data);
          }
        })
        .catch(() => setError("Failed to load profile."))
        .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-white p-4">
        <div className="bg-zinc-900/50 border border-white/10 p-8 rounded-3xl max-w-md text-center shadow-2xl">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold mb-2">Profile Unavailable</h2>
          <p className="text-zinc-400 text-sm mb-6">{error}</p>
          <Link href="/" className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl font-bold transition-all inline-block">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const { users, stats } = profile;

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden pb-32">
      {/* Background Blurs */}
      <div className="fixed top-0 left-1/4 w-1/2 h-[500px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-1/4 w-1/3 h-[400px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none z-0" />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-32 relative z-10 max-w-5xl animate-fade-in-up">
        
        {/* HERO BANNER */}
        <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 md:p-12 shadow-2xl relative overflow-hidden mb-8 text-center flex flex-col items-center">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 pointer-events-none" />
          
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-6 relative">
            {users.map((user: any, idx: number) => (
              <div key={idx} className="flex flex-col items-center">
                <div className="relative mb-4">
                  <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-40 animate-pulse"></div>
                  <img 
                    src={user.avatar || "/logo.png"} 
                    alt="Avatar" 
                    className="w-20 h-20 md:w-28 md:h-28 rounded-full border-4 border-zinc-900 shadow-2xl relative z-10"
                  />
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">{user.name}</h1>
              </div>
            ))}
          </div>
          
          <p className="text-indigo-400 text-sm font-semibold uppercase tracking-widest mb-6">The Goats DJ Profile</p>
          
          <div className="bg-zinc-900/50 border border-white/10 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl flex items-center justify-center gap-4 hover:border-indigo-500/30 transition-colors">
             <div className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Total Scrobbles</div>
             <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
               {stats.playcount.toLocaleString()}
             </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          
          {/* Top Artists Grid */}
          <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
             <div className="px-6 sm:px-8 py-5 border-b border-white/5 bg-white/[0.01]">
               <h3 className="text-xl font-bold flex items-center gap-2">⭐ Top Artists</h3>
               <p className="text-zinc-400 text-sm mt-1">Their most listened to artists of all time.</p>
             </div>
             <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
               {stats.topArtists.length > 0 ? stats.topArtists.map((artist: any, i: number) => (
                 <a 
                   key={i} 
                   href={artist.url} 
                   target="_blank"
                   rel="noreferrer"
                   className="bg-zinc-900/30 hover:bg-zinc-800/50 border border-white/5 hover:border-indigo-500/30 rounded-2xl p-4 flex flex-col items-center text-center transition-all group"
                 >
                   <div className="w-16 h-16 rounded-full bg-zinc-800 mb-3 overflow-hidden shadow-lg group-hover:scale-105 transition-transform">
                      {artist.image && !artist.image.includes("2a96cbd8b46e442fc41c2b86b821562f") ? (
                        <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl bg-zinc-800">🎤</div>
                      )}
                   </div>
                   <div className="font-bold text-sm text-white group-hover:text-indigo-400 transition-colors line-clamp-1 w-full">{artist.name}</div>
                   <div className="text-xs text-zinc-500 font-medium mt-1">{parseInt(artist.playcount).toLocaleString()} plays</div>
                 </a>
               )) : (
                 <div className="col-span-2 text-center py-8 text-zinc-500">No top artists found.</div>
               )}
             </div>
          </div>

          {/* Recent Tracks List */}
          <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
             <div className="px-8 py-6 border-b border-white/5 bg-white/[0.01]">
               <h3 className="text-xl font-bold flex items-center gap-2">🎧 Recent Tracks</h3>
               <p className="text-zinc-400 text-sm mt-1">What they've been listening to lately.</p>
             </div>
             <div className="divide-y divide-white/5">
               {stats.recentTracks.length > 0 ? stats.recentTracks.map((track: any, i: number) => (
                 <a 
                   key={i} 
                   href={track.url}
                   target="_blank"
                   rel="noreferrer"
                   className="flex items-center gap-4 p-5 hover:bg-white/[0.02] transition-colors group"
                 >
                   <div className="w-12 h-12 rounded-lg bg-zinc-800 shrink-0 overflow-hidden shadow-md">
                     {track.image ? (
                       <img src={track.image} alt="Album Art" className="w-full h-full object-cover" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center text-xl">🎵</div>
                     )}
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className="font-bold text-sm text-white truncate group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                       {track.name}
                       {track.nowPlaying && (
                         <span className="shrink-0 flex items-center gap-1 bg-green-500/10 text-green-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border border-green-500/20">
                           <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                           Playing
                         </span>
                       )}
                     </div>
                     <div className="text-xs text-zinc-400 truncate mt-1">{track.artist}</div>
                   </div>
                   {!track.nowPlaying && track.date && (
                     <div className="text-[10px] text-zinc-500 whitespace-nowrap shrink-0">
                       {new Date(parseInt(track.date) * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                     </div>
                   )}
                 </a>
               )) : (
                 <div className="text-center py-8 text-zinc-500">No recent tracks found.</div>
               )}
             </div>
          </div>

        </div>
      </main>
    </div>
  );
}
