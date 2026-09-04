"use client";

import { useCallback, useEffect, useState } from "react";
import { Music, Play, Pause, SkipForward, SkipBack, Heart, ExternalLink } from "lucide-react";

type NowPlaying = {
  is_playing: boolean;
  song?: string;
  artist?: string;
  album?: string;
  album_art?: string;
  progress_ms?: number;
  duration_ms?: number;
  id?: string | null;
  uri?: string | null;
  spotify_url?: string | null;
  device?: string | null;
  is_liked?: boolean;
  error?: string;
};

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function MusicDashboard() {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [tick, setTick] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);

  const authHeaders = () => {
    const token = localStorage.getItem("discord_jwt");
    return { Authorization: `Bearer ${token}` };
  };

  const fetchNowPlaying = useCallback(async () => {
    const token = localStorage.getItem("discord_jwt");
    if (!token) {
      window.location.href = "/api/auth/login";
      return;
    }
    try {
      const res = await fetch("/api/spotify/now-playing", { headers: authHeaders() });
      if (res.status === 404) {
        setError("You have not linked your Spotify account. Go to Settings or type ,play in Discord to link it.");
        return;
      }
      const data: NowPlaying = await res.json();
      if (data.error === "not_linked") {
        setError("You have not linked your Spotify account. Go to Settings or type ,play in Discord to link it.");
        return;
      }
      if (data.error) throw new Error(data.error);
      setError(null);
      setNowPlaying(data);
      setFetchedAt(Date.now());
      setTick(Date.now());
      if (typeof data.is_liked === "boolean") setLiked(data.is_liked);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch now playing data.");
    }
  }, []);

  useEffect(() => {
    fetchNowPlaying();
    const poll = setInterval(fetchNowPlaying, 5000); // re-sync with Spotify
    const ticker = setInterval(() => setTick(Date.now()), 1000); // smooth progress
    return () => { clearInterval(poll); clearInterval(ticker); };
  }, [fetchNowPlaying]);

  const control = async (action: "play" | "pause" | "next" | "previous") => {
    setBusy(action);
    setControlError(null);
    try {
      const res = await fetch("/api/spotify/control", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Control failed");
      await fetchNowPlaying(); // sync immediately instead of waiting for poll
    } catch (e: unknown) {
      setControlError(e instanceof Error ? e.message : "Control failed");
    } finally {
      setBusy(null);
    }
  };

  const toggleLike = async () => {
    if (!nowPlaying?.id) return;
    const action = liked ? "unlike" : "like";
    setLiked(!liked); // optimistic
    try {
      const res = await fetch("/api/spotify/like", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ id: nowPlaying.id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Like failed");
      if (typeof data.liked === "boolean") setLiked(data.liked);
    } catch {
      setLiked(liked); // revert on failure
    }
  };

  const base = nowPlaying?.progress_ms || 0;
  const duration = nowPlaying?.duration_ms || 0;
  const live = nowPlaying?.is_playing ? Math.min(base + Math.max(0, tick - fetchedAt), duration || base) : base;

  return (
    <div className="min-h-screen bg-[#09090b] text-white pt-20 px-4 sm:px-6 lg:px-8 pb-10">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Music className="w-8 h-8 text-green-500" />
          Music Dashboard
        </h1>

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
            {/* Background Blur */}
            <div className="absolute inset-0 z-0 opacity-20 blur-3xl scale-150 transition-all duration-1000 group-hover:scale-110" style={{ backgroundImage: `url(${nowPlaying.album_art})`, backgroundPosition: 'center', backgroundSize: 'cover' }}></div>

            <img src={nowPlaying.album_art} alt="Album Art" className="w-64 h-64 rounded-2xl shadow-2xl z-10 object-cover" />

            <div className="flex-1 flex flex-col justify-center z-10 w-full">
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-2 line-clamp-2">{nowPlaying.song}</h2>
              <p className={`text-xl text-zinc-400 font-medium ${nowPlaying.device ? "mb-1" : "mb-8"}`}>{nowPlaying.artist}</p>
              {nowPlaying.device && (
                <p className="text-xs text-zinc-500 mb-6">🔊 {nowPlaying.device}</p>
              )}

              <div className="w-full bg-zinc-800 rounded-full h-2 mb-2 overflow-hidden">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: duration ? `${(live / duration) * 100}%` : "0%" }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-zinc-500 font-medium tracking-widest uppercase mb-6">
                <span>{fmt(live)}</span>
                <span>{fmt(duration)}</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => control("previous")}
                  disabled={busy !== null}
                  title="Previous"
                  className="p-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-40"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={() => control(nowPlaying.is_playing ? "pause" : "play")}
                  disabled={busy !== null}
                  title={nowPlaying.is_playing ? "Pause" : "Play"}
                  className="p-4 rounded-full bg-green-500 hover:bg-green-400 text-black transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                >
                  {busy === "play" || busy === "pause" ? (
                    <span className="w-6 h-6 block border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : nowPlaying.is_playing ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6 ml-0.5" />
                  )}
                </button>
                <button
                  onClick={() => control("next")}
                  disabled={busy !== null}
                  title="Next"
                  className="p-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-40"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
                <button
                  onClick={toggleLike}
                  disabled={!nowPlaying.id}
                  title={liked ? "Unlike" : "Like"}
                  className={`p-3 rounded-full border transition-all disabled:opacity-40 ${liked ? "bg-green-500/20 border-green-500/40 text-green-400" : "bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300"}`}
                >
                  <Heart className={`w-5 h-5 ${liked ? "fill-current" : ""}`} />
                </button>
                {nowPlaying.spotify_url && (
                  <a
                    href={nowPlaying.spotify_url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open in Spotify"
                    className="p-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-zinc-300"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
              </div>

              {controlError && (
                <p className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                  {controlError}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
