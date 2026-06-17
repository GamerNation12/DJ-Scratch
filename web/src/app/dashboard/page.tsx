"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      router.push("/api/auth/signin");
    },
  });
  const router = useRouter();

  const [fmMode, setFmMode] = useState<"compact" | "full" | "stats">("full");
  const [showFeatures, setShowFeatures] = useState<boolean>(false);
  const [privateMode, setPrivateMode] = useState<boolean>(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);

  useEffect(() => {
    if (session) {
      fetch("/api/settings")
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            if (data.fmMode) setFmMode(data.fmMode);
            if (data.showFeatures !== undefined) setShowFeatures(data.showFeatures);
            if (data.privateMode !== undefined) setPrivateMode(data.privateMode);
          }
        })
        .catch((err) => console.error("Error fetching settings:", err));
    }
  }, [session]);

  const updateSetting = async (updates: any) => {
    setUpdatingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fmMode) setFmMode(data.fmMode);
        if (data.showFeatures !== undefined) setShowFeatures(data.showFeatures);
        if (data.privateMode !== undefined) setPrivateMode(data.privateMode);
      } else {
        throw new Error("Failed to update");
      }
    } catch (err) {
      console.error("Error updating settings:", err);
      // Revert states if necessary based on individual updates, or just alert user
      alert("Failed to update settings. Please try again.");
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleUpdateFmMode = (mode: "compact" | "full" | "stats") => {
    setFmMode(mode);
    updateSetting({ fmMode: mode });
  };

  const handleToggleFeatures = () => {
    const newVal = !showFeatures;
    setShowFeatures(newVal);
    updateSetting({ showFeatures: newVal });
  };

  const handleTogglePrivateMode = () => {
    const newVal = !privateMode;
    setPrivateMode(newVal);
    updateSetting({ privateMode: newVal });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden relative">
      <div className="fixed top-0 left-1/4 w-1/2 h-[500px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none z-0" />
      
      <main className="container mx-auto px-6 py-24 relative z-10 max-w-5xl">
        <div className="mb-12 border-b border-white/5 pb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-white via-indigo-200 to-indigo-500 bg-clip-text text-transparent">
            Your Dashboard
          </h1>
          <p className="text-zinc-400 text-lg">Manage your profile, adjust settings, and tailor your music experience.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* User Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 sticky top-24">
              <div className="flex flex-col items-center text-center">
                <img 
                  src={session.user?.image || "/logo.png"} 
                  alt="Avatar" 
                  className="w-24 h-24 rounded-full border-4 border-zinc-800 mb-4 shadow-xl"
                />
                <h2 className="text-2xl font-bold">{session.user?.name}</h2>
                <p className="text-zinc-500 text-sm mb-6">Connected via Discord</p>
                <div className="w-full flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-400 py-2 rounded-xl border border-emerald-500/20 font-medium text-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  Live Sync Active
                </div>
              </div>
            </div>
          </div>

          {/* Settings Section */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Display Preferences */}
            <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
              
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">🎨</span>
                Display Preferences
              </h3>
              <p className="text-zinc-400 text-sm mb-8">Configure how your music is displayed when you use bot commands.</p>

              <label className="block text-sm font-semibold text-zinc-300 mb-4">Default /fm Display Layout</label>
              <div className="grid md:grid-cols-3 gap-4 mb-8">
                {[
                  { id: "compact", icon: "📝", title: "Compact Text", desc: "fm1 (1-line view)" },
                  { id: "full", icon: "🖼️", title: "Full Embed", desc: "fm2 (detailed visual)" },
                  { id: "stats", icon: "📊", title: "Stats View", desc: "fm3 (statistics)" }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => handleUpdateFmMode(mode.id as any)}
                    disabled={updatingSettings}
                    className={`group relative overflow-hidden py-8 px-4 rounded-2xl font-medium border text-center transition-all duration-300 cursor-pointer ${
                      fmMode === mode.id
                        ? "bg-indigo-600/20 border-indigo-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.15)]"
                        : "bg-zinc-950/50 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {fmMode === mode.id && <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />}
                    <div className="text-3xl mb-3 transform group-hover:scale-110 transition-transform">{mode.icon}</div>
                    <div className="text-lg font-bold">{mode.title}</div>
                    <div className="text-sm text-zinc-500 mt-2">{mode.desc}</div>
                  </button>
                ))}
              </div>

              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5 flex items-start gap-4">
                <div className="text-indigo-400 text-xl mt-0.5">💡</div>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  You can override your default layout directly in Discord by typing <code className="bg-black/40 text-emerald-400 px-2 py-0.5 rounded-md font-mono border border-white/10">,fm1</code>, <code className="bg-black/40 text-emerald-400 px-2 py-0.5 rounded-md font-mono border border-white/10">,fm2</code>, or <code className="bg-black/40 text-emerald-400 px-2 py-0.5 rounded-md font-mono border border-white/10">,fm3</code>.
                </p>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">⚙️</span>
                Advanced Settings
              </h3>
              <p className="text-zinc-400 text-sm mb-8">Fine-tune features and privacy options.</p>

              <div className="space-y-2">
                {/* Feature Toggle */}
                <label className="flex items-center justify-between cursor-pointer group p-5 rounded-2xl bg-zinc-950/30 border border-zinc-800/50 hover:bg-zinc-900 transition-colors">
                  <div className="pr-8">
                    <div className="text-lg font-semibold text-white mb-1">Show Featured Artists</div>
                    <div className="text-sm text-zinc-400 leading-relaxed">Automatically extract featured artists from the track name and display them alongside the main artist.</div>
                  </div>
                  <div className="relative shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={showFeatures}
                      onChange={handleToggleFeatures}
                      disabled={updatingSettings}
                    />
                    <div className={`block w-14 h-8 rounded-full transition-colors duration-300 border ${showFeatures ? 'bg-indigo-500 border-indigo-400' : 'bg-zinc-800 border-zinc-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 shadow-sm ${showFeatures ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                </label>

                {/* Privacy Toggle */}
                <label className="flex items-center justify-between cursor-pointer group p-5 rounded-2xl bg-zinc-950/30 border border-zinc-800/50 hover:bg-zinc-900 transition-colors">
                  <div className="pr-8">
                    <div className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                      Private Mode 
                      <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">New</span>
                    </div>
                    <div className="text-sm text-zinc-400 leading-relaxed">Hide your Last.fm username and profile link from bot embeds. Others will only see your Discord name.</div>
                  </div>
                  <div className="relative shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={privateMode}
                      onChange={handleTogglePrivateMode}
                      disabled={updatingSettings}
                    />
                    <div className={`block w-14 h-8 rounded-full transition-colors duration-300 border ${privateMode ? 'bg-amber-500 border-amber-400' : 'bg-zinc-800 border-zinc-700'}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 shadow-sm ${privateMode ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                </label>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
