"use client";

import { Settings, Link2, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

export default function ActivitySettings({ onReplayGuide }: { onReplayGuide?: () => void }) {
  const [defaultTab, setDefaultTab] = useState("guide");

  useEffect(() => {
    const savedTab = localStorage.getItem('activity_default_tab');
    if (savedTab) setDefaultTab(savedTab);
  }, []);

  const handleDefaultTabChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setDefaultTab(val);
    localStorage.setItem('activity_default_tab', val);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative z-10 bg-zinc-950/50 backdrop-blur-sm h-full">
      <div className="max-w-4xl mx-auto flex flex-col gap-8 h-full">
        <div className="h-16 flex items-center mb-2 z-10 flex-shrink-0 border-b border-white/5 pb-4">
          <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
            <Settings className="w-8 h-8 text-indigo-500" />
            Activity Settings
          </h1>
        </div>

        <div className="grid gap-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[50px] rounded-full pointer-events-none transition-all group-hover:scale-150 group-hover:bg-indigo-500/20"></div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0 border border-green-500/30">
                <Link2 className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-white mb-1">Link Spotify & Last.fm</h3>
                <p className="text-sm text-zinc-400 mb-4">
                  To get the most out of the DJ Scratch Discord Activity, make sure your music accounts are linked to your profile.
                </p>
                <a 
                  href="/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-semibold border border-white/10 transition-colors w-fit flex items-center gap-2 text-sm"
                >
                  Manage Connections <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[50px] rounded-full pointer-events-none transition-all group-hover:scale-150 group-hover:bg-purple-500/20"></div>
            <h3 className="text-lg font-bold text-white mb-4">Activity Display Settings</h3>
            
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-3 cursor-pointer group/label">
                <div className="w-5 h-5 rounded border border-indigo-500/50 bg-indigo-500/20 flex items-center justify-center">
                  <div className="w-3 h-3 bg-indigo-400 rounded-sm"></div>
                </div>
                <span className="text-zinc-300 group-hover/label:text-white transition-colors">Show Rich Presence on Discord</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group/label">
                <div className="w-5 h-5 rounded border border-white/20 bg-black/20 flex items-center justify-center">
                </div>
                <span className="text-zinc-400 group-hover/label:text-white transition-colors">Mute notification sounds</span>
              </label>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[50px] rounded-full pointer-events-none transition-all group-hover:scale-150 group-hover:bg-amber-500/20"></div>
            <h3 className="text-lg font-bold text-white mb-4">Activity Preferences</h3>
            
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-zinc-300 font-semibold">Default Startup Page</span>
                <p className="text-xs text-zinc-500">Choose which page opens automatically when you start the Discord Activity.</p>
                <select 
                  className="bg-black/40 border border-white/10 text-white p-2 rounded-lg outline-none focus:border-indigo-500 transition-colors cursor-pointer w-full max-w-xs"
                  value={defaultTab}
                  onChange={handleDefaultTabChange}
                >
                  <option value="guide">Guide</option>
                  <option value="messages">Messages</option>
                  <option value="music">Music</option>
                  <option value="settings">Settings</option>
                </select>
              </label>

              <div className="mt-4 pt-4 border-t border-white/5">
                <button 
                  onClick={() => {
                    localStorage.removeItem('activity_guide_completed');
                    if (onReplayGuide) {
                      onReplayGuide();
                    } else {
                      window.location.reload();
                    }
                  }}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold"
                >
                  Replay Onboarding Guide
                </button>
                <p className="text-xs text-zinc-500 mt-2">This will un-hide the Guide tab and walk you through the setup process again.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
