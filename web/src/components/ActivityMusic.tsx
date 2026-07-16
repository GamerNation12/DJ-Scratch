"use client";

import { useEffect, useState } from "react";
import { Music } from "lucide-react";

interface NowPlayingData {
  is_playing: boolean;
  song?: string;
  artist?: string;
  album_art?: string;
  progress_ms: number;
  duration_ms: number;
  error?: string;
}

export default function ActivityMusic() {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchNowPlaying = async () => {
    const token = localStorage.getItem("discord_jwt");
    if (!token) {
      setError("Not authenticated.");
      return;
    }
    try {
      const res = await fetch("/api/spotify/now-playing", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 404) {
        setError("You have not linked your Spotify account. Go to Settings or type ,play in Discord to link it.");
        return;
      }
      const data = await res.json();
      if (data.error === "not_linked") {
        setError("You have not linked your Spotify account. Go to Settings or type ,play in Discord to link it.");
        return;
      }
      if (data.error) throw new Error(data.error);
      setNowPlaying(data);
    } catch(e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch now playing data.");
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 5000); // poll every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative z-10 bg-zinc-950/50 backdrop-blur-sm h-full">
      <div className="max-w-4xl mx-auto flex flex-col gap-8 h-full">
        <div className="h-16 flex items-center mb-2 z-10 flex-shrink-0">
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
            <Music className="w-8 h-8 text-green-500" />
            Music Control
          </h1>
        </div>

        {error ? (
          <div className="bg-red-900/20 border border-red-500/20 p-6 rounded-2xl text-red-200">
            {error}
          </div>
        ) : !nowPlaying ? (
          <div className="animate-pulse flex gap-6 p-6 bg-zinc-900/50 rounded-2xl border border-white/5">
            <div className="w-48 h-48 bg-zinc-800 rounded-xl"></div>
            <div className="flex-1 flex flex-col gap-4 py-2">
              <div className="w-3/4 h-8 bg-zinc-800 rounded-md"></div>
              <div className="w-1/2 h-6 bg-zinc-800 rounded-md"></div>
            </div>
          </div>
        ) : !nowPlaying.is_playing && !nowPlaying.song ? (
          <div className="bg-zinc-900/50 border border-white/5 p-10 rounded-2xl text-center text-zinc-400">
            <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h2 className="text-xl font-medium text-white mb-2">Nothing is playing right now</h2>
            <p>Start playing music on Spotify to see it here.</p>
          </div>
        ) : (
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 p-6 sm:p-10 rounded-3xl shadow-2xl flex flex-col sm:flex-row gap-8 items-center sm:items-start relative overflow-hidden group">
            <div className="absolute inset-0 z-0 opacity-20 blur-3xl scale-150 transition-all duration-1000 group-hover:scale-110" style={{ backgroundImage: `url(${nowPlaying.album_art})`, backgroundPosition: 'center', backgroundSize: 'cover' }}></div>
            
            <img src={nowPlaying.album_art} alt="Album Art" className="w-64 h-64 rounded-2xl shadow-2xl z-10" />
            
            <div className="flex-1 flex flex-col justify-center z-10 w-full">
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-2 line-clamp-2">{nowPlaying.song}</h2>
              <p className="text-xl text-zinc-400 font-medium mb-8">{nowPlaying.artist}</p>
              
              <div className="w-full bg-zinc-800 rounded-full h-2 mb-2 overflow-hidden">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-1000" 
                  style={{ width: `${(nowPlaying.progress_ms / nowPlaying.duration_ms) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-zinc-500 font-medium tracking-widest uppercase">
                <span>{Math.floor(nowPlaying.progress_ms / 60000)}:{(Math.floor((nowPlaying.progress_ms % 60000) / 1000)).toString().padStart(2, '0')}</span>
                <span>{Math.floor(nowPlaying.duration_ms / 60000)}:{(Math.floor((nowPlaying.duration_ms % 60000) / 1000)).toString().padStart(2, '0')}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
