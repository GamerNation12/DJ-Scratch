"use client";
import { fetchApi } from "@/lib/fetchApi";
import { useSession } from "@/app/providers";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NowPlayingWidget from "@/components/NowPlayingWidget";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);
  
  const [activeTab, setActiveTab] = useState<"settings" | "suggestions">("settings");

  // Settings State
  const [fmMode, setFmMode] = useState<"compact" | "full" | "stats">("full");
  const [showFeatures, setShowFeatures] = useState<boolean>(false);
  const [privateMode, setPrivateMode] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<"combined" | "spotify" | "lastfm">("combined");
  const [timezone, setTimezone] = useState<string>("UTC");
  const [showTrackPlaycount, setShowTrackPlaycount] = useState<boolean>(false);
  
  // Unsaved Changes State
  const [unsavedFmMode, setUnsavedFmMode] = useState<"compact" | "full" | "stats">("full");
  const [unsavedShowFeatures, setUnsavedShowFeatures] = useState<boolean>(false);
  const [unsavedPrivateMode, setUnsavedPrivateMode] = useState<boolean>(false);
  const [unsavedDataSource, setUnsavedDataSource] = useState<"combined" | "spotify" | "lastfm">("combined");
  const [unsavedTimezone, setUnsavedTimezone] = useState<string>("UTC");
  const [unsavedShowTrackPlaycount, setUnsavedShowTrackPlaycount] = useState<boolean>(false);
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Suggestions State
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [newSuggestionTitle, setNewSuggestionTitle] = useState("");
  const [newSuggestionDesc, setNewSuggestionDesc] = useState("");
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  // User Stats State
  const [userStats, setUserStats] = useState<any>(null);
  const [userStatsLoading, setUserStatsLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchApi("/api/settings")
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            if (data.fmMode) { setFmMode(data.fmMode); setUnsavedFmMode(data.fmMode); }
            if (data.showFeatures !== undefined) { setShowFeatures(data.showFeatures); setUnsavedShowFeatures(data.showFeatures); }
            if (data.privateMode !== undefined) { setPrivateMode(data.privateMode); setUnsavedPrivateMode(data.privateMode); }
            if (data.dataSource) { setDataSource(data.dataSource); setUnsavedDataSource(data.dataSource); }
            if (data.timezone) { setTimezone(data.timezone); setUnsavedTimezone(data.timezone); }
            if (data.showTrackPlaycount !== undefined) { setShowTrackPlaycount(data.showTrackPlaycount); setUnsavedShowTrackPlaycount(data.showTrackPlaycount); }
          }
        })
        .catch(console.error);

      fetchSuggestions();

      fetchApi("/api/user-stats")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setUserStats(data.stats);
        })
        .catch(console.error)
        .finally(() => setUserStatsLoading(false));
    }
  }, [session]);

  const fetchSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const res = await fetchApi("/api/suggestions");
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    if (
      unsavedFmMode !== fmMode ||
      unsavedShowFeatures !== showFeatures ||
      unsavedPrivateMode !== privateMode ||
      unsavedDataSource !== dataSource ||
      unsavedTimezone !== timezone ||
      unsavedShowTrackPlaycount !== showTrackPlaycount
    ) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [unsavedFmMode, unsavedShowFeatures, unsavedPrivateMode, unsavedDataSource, unsavedTimezone, unsavedShowTrackPlaycount, fmMode, showFeatures, privateMode, dataSource, timezone, showTrackPlaycount]);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetchApi("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fmMode: unsavedFmMode,
          showFeatures: unsavedShowFeatures,
          privateMode: unsavedPrivateMode,
          dataSource: unsavedDataSource,
          timezone: unsavedTimezone,
          showTrackPlaycount: unsavedShowTrackPlaycount
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fmMode) setFmMode(data.fmMode);
        if (data.showFeatures !== undefined) setShowFeatures(data.showFeatures);
        if (data.privateMode !== undefined) setPrivateMode(data.privateMode);
        if (data.dataSource) setDataSource(data.dataSource);
        if (data.timezone) setTimezone(data.timezone);
        if (data.showTrackPlaycount !== undefined) setShowTrackPlaycount(data.showTrackPlaycount);
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error("Error saving settings:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  const submitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuggestionTitle || !newSuggestionDesc) return;
    setSubmittingSuggestion(true);
    try {
      const res = await fetchApi("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSuggestionTitle, description: newSuggestionDesc })
      });
      if (res.ok) {
        setNewSuggestionTitle("");
        setNewSuggestionDesc("");
        fetchSuggestions();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingSuggestion(false);
    }
  };

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
    <button 
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${checked ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-zinc-800 hover:bg-zinc-700'}`}
    >
      <span className="sr-only">Toggle</span>
      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-out ${checked ? 'translate-x-5 scale-105' : 'translate-x-0'}`} />
    </button>
  );

  const CustomSelect = ({ value, options, onChange }: { value: string, options: {label: string, value: string}[], onChange: (val: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(o => o.value === value) || options[0];

    return (
      <div className="relative w-full">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between gap-3 bg-zinc-900/50 hover:bg-white/5 border rounded-xl px-4 py-3 text-white font-semibold focus:outline-none transition-all shadow-sm ${isOpen ? 'border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'border-white/10 hover:border-white/20'}`}
        >
          <span className="truncate">{selectedOption.label}</span>
          <span className={`shrink-0 text-zinc-500 text-[10px] transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`}>▼</span>
        </button>
        
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
            <div className="absolute z-50 w-full mt-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-y-auto overflow-x-hidden max-h-60 shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-fade-in-up styled-scrollbar">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 truncate hover:bg-indigo-500/20 transition-colors ${value === opt.value ? 'text-indigo-400 font-bold bg-indigo-500/10' : 'text-zinc-300 font-medium'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'approved': return <span className="px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Approved</span>;
      case 'denied': return <span className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Denied</span>;
      case 'completed': return <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Update Released</span>;
      default: return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Pending</span>;
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden relative pb-32">
      {/* Background Blurs */}
      <div className="fixed top-0 left-1/4 w-1/2 h-[500px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-1/4 w-1/3 h-[400px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none z-0" />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 relative z-10 max-w-7xl animate-fade-in-up">
        
        {/* HERO BANNER */}
        <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 pointer-events-none" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                <img 
                  src={session?.user?.image || "/logo.png"} 
                  alt="Avatar" 
                  className="w-20 h-20 rounded-full border-2 border-white/20 shadow-2xl relative z-10"
                />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-1 text-white">{session?.user?.name}</h1>
                <p className="text-indigo-400 text-sm font-semibold uppercase tracking-widest">Discord Connected</p>
              </div>
            </div>
            <div className="w-full md:w-auto min-w-[300px]">
              <NowPlayingWidget />
            </div>
          </div>
        </div>

        {/* AT A GLANCE STATS (Only show if linked) */}
        {!userStatsLoading && userStats && (userStats.hasLastfm || userStats.hasSpotify) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {userStats.hasSpotify && (
              <>
                <div className="bg-zinc-950/40 backdrop-blur-2xl border border-white/5 hover:border-green-500/30 rounded-2xl p-5 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(34,197,94,0.1)] group">
                  <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-2 group-hover:text-green-400 transition-colors">Spotify Streams</div>
                  <div className="text-2xl md:text-3xl font-extrabold text-white">{userStats.spotify.playcount.toLocaleString()}</div>
                </div>
                <div className="bg-zinc-950/40 backdrop-blur-2xl border border-white/5 hover:border-green-500/30 rounded-2xl p-5 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(34,197,94,0.1)] group">
                  <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-2 group-hover:text-green-400 transition-colors">Spotify Top Artist</div>
                  <div className="text-xl font-bold text-white truncate" title={userStats.spotify.topArtist}>{userStats.spotify.topArtist}</div>
                  <div className="text-xs text-zinc-400 mt-1">{userStats.spotify.topArtistPlays.toLocaleString()} plays</div>
                </div>
              </>
            )}
            {userStats.hasLastfm && (
              <>
                <div className="bg-zinc-950/40 backdrop-blur-2xl border border-white/5 hover:border-red-500/30 rounded-2xl p-5 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(239,68,68,0.1)] group">
                  <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-2 group-hover:text-red-400 transition-colors">Last.fm Scrobbles</div>
                  <div className="text-2xl md:text-3xl font-extrabold text-white">{userStats.lastfm.playcount.toLocaleString()}</div>
                </div>
                <div className="bg-zinc-950/40 backdrop-blur-2xl border border-white/5 hover:border-red-500/30 rounded-2xl p-5 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(239,68,68,0.1)] group">
                  <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-2 group-hover:text-red-400 transition-colors">Last.fm Top Artist</div>
                  <div className="text-xl font-bold text-white truncate" title={userStats.lastfm.topArtist}>{userStats.lastfm.topArtist}</div>
                  <div className="text-xs text-zinc-400 mt-1">{userStats.lastfm.topArtistPlays.toLocaleString()} plays</div>
                </div>
              </>
            )}
          </div>
        )}

        {!userStatsLoading && !userStats && (
          <div className="mb-12 text-center p-8 text-zinc-500 bg-zinc-900/30 rounded-3xl border border-white/5 border-dashed">
            Account not linked. Use the bot on Discord to link your account.
          </div>
        )}

        {/* TAB SWITCHER */}
        <div className="flex items-center justify-center mb-8">
          <div className="bg-zinc-900/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 flex gap-2">
            <button 
              onClick={() => setActiveTab("settings")}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'settings' ? 'bg-white/10 text-white shadow-lg' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            >
              ⚙️ Preferences
            </button>
            <button 
              onClick={() => setActiveTab("suggestions")}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'suggestions' ? 'bg-emerald-500/20 text-emerald-300 shadow-lg border border-emerald-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
            >
              💡 Feedback & Ideas
            </button>
          </div>
        </div>

        {/* TAB CONTENT */}
        {activeTab === "settings" && (
          <div className="grid lg:grid-cols-2 gap-8 items-start animate-fade-in">
            
            {/* LEFT COLUMN */}
            <div className="space-y-8">
              {/* Display Layout Card */}
              <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-20" />
                <div className="px-8 py-6 border-b border-white/5 bg-white/[0.01]">
                  <h3 className="text-xl font-bold">Display Layout</h3>
                  <p className="text-zinc-400 text-sm mt-1">Select the default style for your Last.fm embeds.</p>
                </div>
                
                <div className="p-8">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { id: "compact", icon: "📝", title: "Compact", desc: "1-line minimal view" },
                      { id: "full", icon: "🖼️", title: "Full Embed", desc: "Detailed visual view" },
                      { id: "stats", icon: "📊", title: "Stats View", desc: "Statistics & charts" }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setUnsavedFmMode(mode.id as any)}
                        className={`relative flex flex-col items-start p-6 rounded-2xl border transition-all duration-300 text-left group ${
                          unsavedFmMode === mode.id
                            ? "bg-indigo-500/10 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.15)] sm:scale-105 z-10"
                            : "bg-zinc-900/30 border-white/5 hover:border-white/20 hover:bg-zinc-900/50"
                        }`}
                      >
                        <div className={`text-2xl mb-4 transition-transform duration-300 ${unsavedFmMode === mode.id ? 'scale-110' : 'group-hover:scale-110'}`}>{mode.icon}</div>
                        <div className={`text-lg font-bold ${unsavedFmMode === mode.id ? 'text-indigo-300' : 'text-white'}`}>{mode.title}</div>
                        <div className="text-sm text-zinc-500 mt-1">{mode.desc}</div>
                        
                        <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${unsavedFmMode === mode.id ? 'border-indigo-500' : 'border-zinc-700'}`}>
                          {unsavedFmMode === mode.id && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-fade-in"></div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Data Source & Timezone */}
              <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/5 rounded-3xl shadow-2xl relative z-20">
                <div className="px-8 py-6 border-b border-white/5 bg-white/[0.01] rounded-t-3xl">
                  <h3 className="text-xl font-bold">Localization</h3>
                  <p className="text-zinc-400 text-sm mt-1">Configure where the bot pulls stats and resets.</p>
                </div>
                
                <div className="divide-y divide-white/5">
                  <div className="p-8 flex flex-col gap-4">
                    <div>
                      <div className="text-lg font-semibold text-white mb-1">Active Data Source</div>
                      <div className="text-sm text-zinc-400">Choose between Last.fm, imported Spotify data, or combined.</div>
                    </div>
                    <CustomSelect 
                      value={unsavedDataSource} 
                      onChange={(val) => setUnsavedDataSource(val as any)}
                      options={[
                        { value: "combined", label: "Combined" },
                        { value: "lastfm", label: "Last.fm Only" },
                        { value: "spotify", label: "Spotify Only" }
                      ]}
                    />
                  </div>

                  <div className="p-8 flex flex-col gap-4">
                    <div>
                      <div className="text-lg font-semibold text-white mb-1">Timezone</div>
                      <div className="text-sm text-zinc-400">Set your local timezone so daily resets are accurate.</div>
                    </div>
                    <CustomSelect 
                      value={unsavedTimezone} 
                      onChange={(val) => setUnsavedTimezone(val)}
                      options={[
                        { value: "UTC", label: "UTC (Default)" },
                        { value: "America/New_York", label: "America/New_York" },
                        { value: "America/Chicago", label: "America/Chicago" },
                        { value: "America/Denver", label: "America/Denver" },
                        { value: "America/Los_Angeles", label: "America/Los_Angeles" },
                        { value: "Europe/London", label: "Europe/London" },
                        { value: "Europe/Berlin", label: "Europe/Berlin" },
                        { value: "Asia/Tokyo", label: "Asia/Tokyo" },
                        { value: "Australia/Sydney", label: "Australia/Sydney" }
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-8">
              {/* Feature Toggles Card */}
              <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
                <div className="px-8 py-6 border-b border-white/5 bg-white/[0.01]">
                  <h3 className="text-xl font-bold">Feature & Privacy Toggles</h3>
                  <p className="text-zinc-400 text-sm mt-1">Fine-tune exactly how the bot behaves.</p>
                </div>
                
                <div className="divide-y divide-white/5">
                  <div className="p-8 flex items-start sm:items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1">
                      <div className="text-lg font-semibold text-white mb-1">Show Track Playcounts</div>
                      <div className="text-sm text-zinc-400">
                        Display your personal playcount for the current track right in the Now Playing embed.
                      </div>
                    </div>
                    <div className="shrink-0 pt-1 sm:pt-0">
                      <ToggleSwitch checked={unsavedShowTrackPlaycount} onChange={() => setUnsavedShowTrackPlaycount(!unsavedShowTrackPlaycount)} />
                    </div>
                  </div>

                  <div className="p-8 flex items-start sm:items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1">
                      <div className="text-lg font-semibold text-white mb-1">Show Featured Artists</div>
                      <div className="text-sm text-zinc-400">
                        Automatically extract featured artists from the track name and display them distinctly.
                      </div>
                    </div>
                    <div className="shrink-0 pt-1 sm:pt-0">
                      <ToggleSwitch checked={unsavedShowFeatures} onChange={() => setUnsavedShowFeatures(!unsavedShowFeatures)} />
                    </div>
                  </div>

                  <div className="p-8 flex items-start sm:items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1">
                      <div className="text-lg font-semibold text-white mb-1 flex items-center gap-3">
                        Private Mode 
                        <span className="text-[10px] uppercase font-bold bg-amber-500/10 text-amber-500 px-2.5 py-0.5 rounded-full border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]">Privacy</span>
                      </div>
                      <div className="text-sm text-zinc-400">
                        Hide your Last.fm username and profile link from bot embeds. Others will only see your Discord name.
                      </div>
                    </div>
                    <div className="shrink-0 pt-1 sm:pt-0">
                      <ToggleSwitch checked={unsavedPrivateMode} onChange={() => setUnsavedPrivateMode(!unsavedPrivateMode)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "suggestions" && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
            {/* Submit Suggestion Card */}
            <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-20" />
              <div className="px-8 py-6 border-b border-white/5 bg-white/[0.01]">
                <h3 className="text-xl font-bold flex items-center gap-2">💡 Submit Feedback</h3>
                <p className="text-zinc-400 text-sm mt-1">Have an idea for the bot or dashboard? Let the developer know.</p>
              </div>
              <form onSubmit={submitSuggestion} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-2">Idea Title</label>
                  <input 
                    required
                    type="text" 
                    value={newSuggestionTitle}
                    onChange={(e) => setNewSuggestionTitle(e.target.value)}
                    placeholder="e.g. Add a new embed layout"
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-600 shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-2">Description</label>
                  <textarea 
                    required
                    value={newSuggestionDesc}
                    onChange={(e) => setNewSuggestionDesc(e.target.value)}
                    placeholder="Describe how it should work..."
                    rows={4}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-600 shadow-inner"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={submittingSuggestion}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                >
                  {submittingSuggestion ? "Submitting..." : "Send Suggestion"}
                </button>
              </form>
            </div>

            {/* My Suggestions List */}
            <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
              <div className="px-8 py-6 border-b border-white/5 bg-white/[0.01]">
                <h3 className="text-xl font-bold">My Submissions</h3>
                <p className="text-zinc-400 text-sm mt-1">Track the status of your ideas submitted from Discord or the Web.</p>
              </div>
              <div className="divide-y divide-white/5">
                {suggestionsLoading ? (
                  <div className="p-8 text-center text-zinc-500">Loading...</div>
                ) : suggestions.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 italic bg-white/[0.01]">You haven't submitted any suggestions yet.</div>
                ) : (
                  suggestions.map((s) => (
                    <div key={s.id} className="p-8 hover:bg-white/[0.02] transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                        <div>
                          <h4 className="text-lg font-bold text-white">{s.title}</h4>
                          <p className="text-xs text-zinc-500 mt-1">{new Date(s.created_at).toLocaleString()}</p>
                        </div>
                        <div className="shrink-0">{getStatusBadge(s.status)}</div>
                      </div>
                      <p className="text-zinc-400 text-sm mb-5 leading-relaxed bg-zinc-900/30 p-5 rounded-2xl border border-white/5">
                        {s.description}
                      </p>
                      {s.admin_feedback && (
                        <div className="bg-indigo-500/10 border border-indigo-500/20 p-5 rounded-2xl relative shadow-[0_0_15px_rgba(99,102,241,0.05)]">
                          <div className="absolute -left-1.5 top-6 w-3 h-3 bg-[#13131c] rotate-45 border-l border-t border-indigo-500/20"></div>
                          <h5 className="text-indigo-400 text-xs font-bold uppercase tracking-widest mb-2">Developer Reply</h5>
                          <p className="text-indigo-100 text-sm leading-relaxed">{s.admin_feedback}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Save Pill */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 transition-all duration-500 z-50 ${hasUnsavedChanges ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'}`}>
        <div className="bg-zinc-900/95 backdrop-blur-3xl border border-indigo-500/40 p-3 pr-4 rounded-full shadow-[0_10px_50px_rgba(99,102,241,0.3)] flex items-center gap-6">
          <div className="flex items-center gap-3 pl-4">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
            <div className="text-indigo-100 text-sm font-bold tracking-wide">UNSAVED CHANGES</div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                setUnsavedFmMode(fmMode);
                setUnsavedShowFeatures(showFeatures);
                setUnsavedPrivateMode(privateMode);
                setUnsavedDataSource(dataSource);
                setUnsavedTimezone(timezone);
                setUnsavedShowTrackPlaycount(showTrackPlaycount);
              }}
              className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
            >
              DISCARD
            </button>
            <button 
              onClick={saveSettings}
              disabled={savingSettings}
              className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-full transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] disabled:opacity-50 disabled:shadow-none"
            >
              {savingSettings ? "SAVING..." : "SAVE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
