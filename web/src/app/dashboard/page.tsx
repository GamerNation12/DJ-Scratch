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
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleUpdateFmMode = (mode: "compact" | "full" | "stats") => {
    setFmMode(mode);
    updateSetting({ fmMode: mode });
  };

  const ToggleSwitch = ({ checked, onChange, disabled }: { checked: boolean, onChange: () => void, disabled: boolean }) => (
    <button 
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75 ${checked ? 'bg-indigo-500' : 'bg-zinc-800'}`}
    >
      <span className="sr-only">Toggle</span>
      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden relative">
      <div className="fixed top-0 left-1/4 w-1/2 h-[500px] bg-indigo-600/5 rounded-full blur-[150px] pointer-events-none z-0" />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-32 relative z-10 max-w-7xl animate-fade-in-up">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
            Settings
          </h1>
          <p className="text-zinc-400 text-lg">Manage your account and preferences.</p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Side Nav / Profile Profile */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-zinc-950/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
                <img 
                  src={session.user?.image || "/logo.png"} 
                  alt="Avatar" 
                  className="w-16 h-16 rounded-full border border-zinc-800 shadow-xl"
                />
                <div>
                  <h2 className="font-bold text-lg leading-tight">{session.user?.name}</h2>
                  <p className="text-zinc-500 text-xs mt-1">Discord User</p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="w-full flex items-center gap-3 px-3 py-2 bg-white/5 text-white rounded-lg text-sm font-medium">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  Preferences
                </div>
              </div>
            </div>
            
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
              <span className="text-emerald-400 text-sm font-medium">Sync Status</span>
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Display Preferences Card */}
            <div className="bg-zinc-950/50 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-xl font-bold">Display Layout</h3>
                <p className="text-zinc-400 text-sm mt-1">Select the default style for your Last.fm embeds.</p>
              </div>
              
              <div className="p-8">
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { id: "compact", icon: "📝", title: "Compact", desc: "1-line minimal view" },
                    { id: "full", icon: "🖼️", title: "Full Embed", desc: "Detailed visual view" },
                    { id: "stats", icon: "📊", title: "Stats View", desc: "Statistics & charts" }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => handleUpdateFmMode(mode.id as any)}
                      disabled={updatingSettings}
                      className={`relative flex flex-col items-start p-6 rounded-2xl border transition-all duration-300 text-left ${
                        fmMode === mode.id
                          ? "bg-indigo-500/10 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.1)]"
                          : "bg-zinc-900/50 border-white/5 hover:border-white/20 hover:bg-zinc-900"
                      }`}
                    >
                      <div className="text-2xl mb-4">{mode.icon}</div>
                      <div className={`text-lg font-bold ${fmMode === mode.id ? 'text-indigo-300' : 'text-white'}`}>{mode.title}</div>
                      <div className="text-sm text-zinc-500 mt-1">{mode.desc}</div>
                      
                      {/* Selection Indicator */}
                      <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${fmMode === mode.id ? 'border-indigo-500' : 'border-zinc-700'}`}>
                        {fmMode === mode.id && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></div>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Advanced Settings Card */}
            <div className="bg-zinc-950/50 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-xl font-bold">Feature & Privacy Toggles</h3>
                <p className="text-zinc-400 text-sm mt-1">Fine-tune exactly how the bot handles your data.</p>
              </div>
              
              <div className="divide-y divide-white/5">
                {/* Feature Toggle */}
                <div className="p-8 flex items-center justify-between">
                  <div className="pr-8">
                    <div className="text-lg font-semibold text-white mb-1">Show Featured Artists</div>
                    <div className="text-sm text-zinc-400 leading-relaxed max-w-xl">
                      Automatically extract featured artists from the track name and display them distinctly.
                    </div>
                  </div>
                  <ToggleSwitch 
                    checked={showFeatures} 
                    onChange={() => {
                      const newVal = !showFeatures;
                      setShowFeatures(newVal);
                      updateSetting({ showFeatures: newVal });
                    }} 
                    disabled={updatingSettings} 
                  />
                </div>

                {/* Privacy Toggle */}
                <div className="p-8 flex items-center justify-between">
                  <div className="pr-8">
                    <div className="text-lg font-semibold text-white mb-1 flex items-center gap-3">
                      Private Mode 
                      <span className="text-[10px] uppercase font-bold bg-amber-500/10 text-amber-500 px-2.5 py-0.5 rounded-full border border-amber-500/20">Privacy</span>
                    </div>
                    <div className="text-sm text-zinc-400 leading-relaxed max-w-xl">
                      Hide your Last.fm username and profile link from bot embeds. Others will only see your Discord name.
                    </div>
                  </div>
                  <ToggleSwitch 
                    checked={privateMode} 
                    onChange={() => {
                      const newVal = !privateMode;
                      setPrivateMode(newVal);
                      updateSetting({ privateMode: newVal });
                    }} 
                    disabled={updatingSettings} 
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
