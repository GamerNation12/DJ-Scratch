"use client";
import { useState, useEffect } from "react";
import { fetchApi } from "@/lib/fetchApi";

export default function NowPlayingWidget() {
  const [nowPlaying, setNowPlaying] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNowPlaying = async () => {
      try {
        const res = await fetchApi("/api/now-playing");
        const data = await res.json();
        if (data.playing) {
          setNowPlaying(data.track);
        } else {
          setNowPlaying(null);
        }
      } catch (err) {
        console.error("Error fetching now playing:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;
  if (!nowPlaying) return null;

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
        <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Now Playing</span>
      </div>
      <a href={nowPlaying.url} target="_blank" rel="noreferrer" className="group flex items-center gap-3 bg-white/[0.02] hover:bg-white/[0.05] p-2.5 rounded-2xl border border-white/5 hover:border-white/10 transition-all shadow-lg">
        {nowPlaying.image ? (
          <img src={nowPlaying.image} alt="Album Art" className="w-10 h-10 rounded-xl shadow-md group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-lg">🎵</div>
        )}
        <div className="overflow-hidden flex-1 min-w-0 pr-4">
          <div className="font-bold text-sm text-white truncate group-hover:text-green-400 transition-colors">{nowPlaying.name}</div>
          <div className="text-xs text-zinc-400 truncate">{nowPlaying.artist}</div>
        </div>
      </a>
    </div>
  );
}
