"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const [fmMode, setFmMode] = useState<"compact" | "full" | "stats">("full");
  const [showFeatures, setShowFeatures] = useState<boolean>(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);

  useEffect(() => {
    if (session) {
      fetch("/api/settings")
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            if (data.fmMode) setFmMode(data.fmMode);
            if (data.showFeatures !== undefined) setShowFeatures(data.showFeatures);
          }
        })
        .catch((err) => console.error("Error fetching settings:", err));
    }
  }, [session]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">The Goats DJ</h1>
        <p className="text-zinc-400 mb-8 text-center max-w-md">Login with Discord to manage your profile and server settings.</p>
        <button
          onClick={() => signIn("discord")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-full transition-all duration-200 shadow-lg shadow-indigo-500/30 cursor-pointer"
        >
          Login with Discord
        </button>
      </div>
    );
  }

  const handleUpdateFmMode = async (mode: "compact" | "full" | "stats") => {
    setUpdatingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fmMode: mode }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fmMode) setFmMode(data.fmMode);
      }
    } catch (err) {
      console.error("Error updating settings:", err);
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleToggleFeatures = async () => {
    const newValue = !showFeatures;
    setShowFeatures(newValue); // Optimistic update
    setUpdatingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showFeatures: newValue }),
      });
      if (!res.ok) {
        // Revert on failure
        setShowFeatures(!newValue);
      }
    } catch (err) {
      console.error("Error updating feature settings:", err);
      setShowFeatures(!newValue);
    } finally {
      setUpdatingSettings(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4 relative overflow-hidden">
      {/* Decorative gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px]" />

      <div className="absolute top-6 right-6 flex items-center gap-4 z-10">
        <span className="text-zinc-400">Logged in as <strong className="text-white">{session.user?.name}</strong></span>
        <button onClick={() => signOut()} className="text-sm bg-zinc-800 hover:bg-zinc-700 py-2 px-4 rounded-md transition-colors cursor-pointer">Sign Out</button>
      </div>

      <div className="max-w-2xl w-full z-10 mt-16 mb-8 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent mb-4">The Goats DJ Dashboard</h1>
        <p className="text-zinc-400 text-lg">Manage your profile, customize your Discord layouts, and configure your experience.</p>
      </div>

      <div className="max-w-2xl w-full z-10">
        <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-8 shadow-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">⚙️ User Settings</h2>
            <p className="text-zinc-400 text-sm mb-8">Customize your bot experience and default display modes.</p>

            <div className="flex flex-col gap-8">
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-3">Default /fm Display Layout</label>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => handleUpdateFmMode("compact")}
                    disabled={updatingSettings}
                    className={`py-6 px-4 rounded-xl font-medium border text-center transition-all duration-200 cursor-pointer ${
                      fmMode === "compact"
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-500/5"
                        : "bg-zinc-800/40 border-zinc-700/50 hover:bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    <div className="text-2xl mb-2">📝</div>
                    <div className="text-base font-bold">Compact Text</div>
                    <div className="text-xs text-zinc-500 font-normal mt-1">fm1 (1-line)</div>
                  </button>

                  <button
                    onClick={() => handleUpdateFmMode("full")}
                    disabled={updatingSettings}
                    className={`py-6 px-4 rounded-xl font-medium border text-center transition-all duration-200 cursor-pointer ${
                      fmMode === "full"
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-500/5"
                        : "bg-zinc-800/40 border-zinc-700/50 hover:bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    <div className="text-2xl mb-2">🖼️</div>
                    <div className="text-base font-bold">Full Embed</div>
                    <div className="text-xs text-zinc-500 font-normal mt-1">fm2 (detailed)</div>
                  </button>

                  <button
                    onClick={() => handleUpdateFmMode("stats")}
                    disabled={updatingSettings}
                    className={`py-6 px-4 rounded-xl font-medium border text-center transition-all duration-200 cursor-pointer ${
                      fmMode === "stats"
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-lg shadow-indigo-500/5"
                        : "bg-zinc-800/40 border-zinc-700/50 hover:bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    <div className="text-2xl mb-2">📊</div>
                    <div className="text-base font-bold">Stats View</div>
                    <div className="text-xs text-zinc-500 font-normal mt-1">fm3 (stats.fm)</div>
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-800/50">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div>
                    <div className="text-base font-semibold text-zinc-300">Show Audio Features in /fm</div>
                    <div className="text-sm text-zinc-500 mt-1">Toggle track features like stats.fm (BPM, Energy, Danceability) on your /fm embed.</div>
                  </div>
                  <div className="relative ml-4">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={showFeatures}
                      onChange={handleToggleFeatures}
                      disabled={updatingSettings}
                    />
                    <div className={`block w-14 h-8 rounded-full transition-colors duration-300 ${showFeatures ? 'bg-emerald-500' : 'bg-zinc-700'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ${showFeatures ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                </label>
              </div>

              <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-5 mt-2">
                <span className="text-zinc-400 text-sm leading-relaxed block">
                  💡 <strong className="text-zinc-300">Tip:</strong> Even with a custom default set here, you can always override it in Discord by explicitly using <code className="bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded">,fm1</code>, <code className="bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded">,fm2</code>, or <code className="bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded">,fm3</code>!
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-zinc-800/50 pt-6 flex items-center justify-between text-sm text-zinc-500">
            <span>Linked with Discord</span>
            <span className="text-emerald-400 flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              Settings Synced
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
