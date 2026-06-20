"use client";

import { useEffect, useState } from "react";
import { DiscordSDK } from "@discord/embedded-app-sdk";

const PERIODS = [
  { value: '7day', label: '7 Days' },
  { value: '1month', label: '1 Month' },
  { value: '3month', label: '3 Months' },
  { value: '6month', label: '6 Months' },
  { value: '12month', label: '1 Year' },
  { value: 'overall', label: 'All Time' }
];

export default function ActivityClient({ clientId }: { clientId: string }) {
  const [auth, setAuth] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [period, setPeriod] = useState<string>('7day');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let sdk: DiscordSDK;
    try {
      sdk = new DiscordSDK(clientId);
    } catch (e: any) {
      console.error("SDK Init Error:", e);
      setError("This page must be opened within a Discord Voice Channel Activity.");
      setLoading(false);
      return;
    }

    async function setupDiscordSdk() {
      try {
        await sdk.ready();
        
        const { code } = await sdk.commands.authorize({
          client_id: clientId,
          response_type: "code",
          state: "",
          prompt: "none",
          scope: ["identify"]
        });

        const response = await fetch("/api/activity/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        
        if (!response.ok) throw new Error("Failed to exchange token");
        
        const { access_token } = await response.json();
        
        const authResult = await sdk.commands.authenticate({ access_token });
        if (!authResult) throw new Error("Authenticate command failed");
        
        setAuth(authResult);
      } catch (e: any) {
        console.error("Discord SDK setup error:", e);
        setError("This page must be opened within a Discord Voice Channel Activity.");
        setLoading(false);
      }
    }
    
    setupDiscordSdk();
  }, [clientId]);

  useEffect(() => {
    if (!auth?.user?.id) return;
    
    setLoading(true);
    
    fetch(`/api/activity/stats?userId=${auth.user.id}&period=${period}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setStats(data.stats);
      })
      .catch(() => setError("Failed to fetch stats."))
      .finally(() => setLoading(false));
  }, [auth, period]);

  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-white p-4">
        <div className="bg-zinc-900/50 border border-red-500/20 p-8 rounded-3xl max-w-md text-center shadow-2xl">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Error Loading Activity</h2>
          <p className="text-zinc-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden p-4 sm:p-8">
      <div className="fixed top-0 left-0 w-full h-[300px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none z-0" />
      
      <div className="relative z-10 max-w-6xl mx-auto">
        <header className="flex flex-col xl:flex-row items-center justify-between gap-6 mb-8 bg-zinc-900/40 p-6 rounded-3xl border border-white/5 backdrop-blur-xl">
          <div className="flex items-center gap-5">
            {auth?.user?.avatar && (
              <img 
                src={`https://cdn.discordapp.com/avatars/${auth.user.id}/${auth.user.avatar}.png`} 
                alt="Avatar" 
                className="w-16 h-16 rounded-full border-2 border-indigo-500 shadow-lg"
              />
            )}
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Your Stats</h1>
              <p className="text-zinc-400 font-medium">Welcome back, {auth?.user?.global_name || auth?.user?.username}!</p>
            </div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-2 bg-zinc-950/80 p-2 rounded-2xl border border-white/10 shadow-inner">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  period === p.value 
                    ? 'bg-indigo-500 text-white shadow-lg' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </header>

        {loading && stats && (
          <div className="fixed top-4 right-4 z-50 bg-indigo-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg animate-pulse">
            Refreshing...
          </div>
        )}

        {stats && (
          <div className="grid lg:grid-cols-2 gap-6 relative">
            
            <div className="flex flex-col gap-6">
              {/* Top Artists Grid */}
              <div className="bg-zinc-950/60 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                 <div className="px-6 py-5 border-b border-white/5 bg-white/[0.01]">
                   <h3 className="text-lg font-bold flex items-center gap-2">⭐ Top Artists</h3>
                 </div>
                 <div className="p-4 grid grid-cols-1 gap-3">
                   {stats.topArtists?.length > 0 ? stats.topArtists.map((artist: any, i: number) => (
                     <a 
                       key={i} 
                       href={artist.url} 
                       target="_blank"
                       rel="noreferrer"
                       className="bg-zinc-900/40 hover:bg-zinc-800 border border-transparent hover:border-indigo-500/30 rounded-2xl p-3 flex items-center gap-4 transition-all group"
                     >
                       <div className="w-14 h-14 rounded-full bg-zinc-800 overflow-hidden shadow-lg group-hover:scale-105 transition-transform shrink-0">
                          {artist.image && !artist.image.includes("2a96cbd8b46e442fc41c2b86b821562f") ? (
                            <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl bg-zinc-800">🎤</div>
                          )}
                       </div>
                       <div className="flex-1 min-w-0">
                          <div className="font-bold text-base text-white group-hover:text-indigo-400 transition-colors truncate">{artist.name}</div>
                          <div className="text-xs text-zinc-500 font-medium mt-0.5">{parseInt(artist.playcount).toLocaleString()} plays</div>
                       </div>
                       <div className="text-2xl font-black text-white/5 mr-4 group-hover:text-white/10">#{i + 1}</div>
                     </a>
                   )) : (
                     <div className="text-center py-8 text-zinc-500">No artists found for this period.</div>
                   )}
                 </div>
              </div>

              {/* Top Albums List */}
              <div className="bg-zinc-950/60 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                 <div className="px-6 py-5 border-b border-white/5 bg-white/[0.01]">
                   <h3 className="text-lg font-bold flex items-center gap-2">💿 Top Albums</h3>
                 </div>
                 <div className="divide-y divide-white/5">
                   {stats.topAlbums?.length > 0 ? stats.topAlbums.map((album: any, i: number) => (
                     <a 
                       key={i} 
                       href={album.url}
                       target="_blank"
                       rel="noreferrer"
                       className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors group"
                     >
                       <div className="w-12 h-12 rounded-lg bg-zinc-800 shrink-0 overflow-hidden shadow-md">
                         {album.image ? (
                           <img src={album.image} alt="Art" className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center text-lg">💿</div>
                         )}
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="font-bold text-sm text-white truncate group-hover:text-indigo-400 transition-colors">
                           {album.name}
                         </div>
                         <div className="text-xs text-zinc-400 truncate mt-0.5">{album.artist}</div>
                       </div>
                       <div className="text-xs text-zinc-500 font-medium shrink-0">
                         {parseInt(album.playcount).toLocaleString()} plays
                       </div>
                     </a>
                   )) : (
                     <div className="text-center py-8 text-zinc-500">No top albums found.</div>
                   )}
                 </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              {/* Top Tracks List */}
              <div className="bg-zinc-950/60 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                 <div className="px-6 py-5 border-b border-white/5 bg-white/[0.01]">
                   <h3 className="text-lg font-bold flex items-center gap-2">🎧 Top Tracks</h3>
                 </div>
                 <div className="divide-y divide-white/5">
                   {stats.topTracks?.length > 0 ? stats.topTracks.map((track: any, i: number) => (
                     <a 
                       key={i} 
                       href={track.url}
                       target="_blank"
                       rel="noreferrer"
                       className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors group"
                     >
                       <div className="w-12 h-12 rounded-lg bg-zinc-800 shrink-0 overflow-hidden shadow-md">
                         {track.image ? (
                           <img src={track.image} alt="Art" className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center text-lg">🎵</div>
                         )}
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="font-bold text-sm text-white truncate group-hover:text-indigo-400 transition-colors">
                           {track.name}
                         </div>
                         <div className="text-xs text-zinc-400 truncate mt-0.5">{track.artist}</div>
                       </div>
                       <div className="text-xs text-zinc-500 font-medium shrink-0">
                         {parseInt(track.playcount).toLocaleString()} plays
                       </div>
                     </a>
                   )) : (
                     <div className="text-center py-8 text-zinc-500">No top tracks found.</div>
                   )}
                 </div>
              </div>

              {/* Recent Tracks List */}
              <div className="bg-zinc-950/60 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                 <div className="px-6 py-5 border-b border-white/5 bg-white/[0.01]">
                   <h3 className="text-lg font-bold flex items-center gap-2">🔄 Recent Tracks</h3>
                 </div>
                 <div className="divide-y divide-white/5">
                   {stats.recentTracks?.length > 0 ? stats.recentTracks.map((track: any, i: number) => (
                     <a 
                       key={i} 
                       href={track.url}
                       target="_blank"
                       rel="noreferrer"
                       className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors group"
                     >
                       <div className="w-12 h-12 rounded-lg bg-zinc-800 shrink-0 overflow-hidden shadow-md">
                         {track.image ? (
                           <img src={track.image} alt="Art" className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center text-lg">🎵</div>
                         )}
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="font-bold text-sm text-white truncate group-hover:text-indigo-400 transition-colors flex items-center gap-2">
                           {track.name}
                           {track.nowPlaying && (
                             <span className="shrink-0 flex items-center gap-1 bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border border-green-500/20">
                               <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                               Playing
                             </span>
                           )}
                         </div>
                         <div className="text-xs text-zinc-400 truncate mt-0.5">{track.artist}</div>
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

          </div>
        )}
      </div>
    </div>
  );
}
