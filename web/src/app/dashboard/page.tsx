"use client";
import { fetchApi } from "@/lib/fetchApi";
import { useSession } from "@/app/providers";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import NowPlayingWidget from "@/components/NowPlayingWidget";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);
  
  const [activeTab, setActiveTab] = useState<"overview" | "embed" | "privacy" | "feedback">("overview");

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

  // User Stats & Bot Status
  const [userStats, setUserStats] = useState<any>(null);
  const [botStatus, setBotStatus] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      fetchApi("/api/settings").then(res => res.json()).then(data => {
        if (data) {
          if (data.fmMode) { setFmMode(data.fmMode); setUnsavedFmMode(data.fmMode); }
          if (data.showFeatures !== undefined) { setShowFeatures(data.showFeatures); setUnsavedShowFeatures(data.showFeatures); }
          if (data.privateMode !== undefined) { setPrivateMode(data.privateMode); setUnsavedPrivateMode(data.privateMode); }
          if (data.dataSource) { setDataSource(data.dataSource); setUnsavedDataSource(data.dataSource); }
          if (data.timezone) { setTimezone(data.timezone); setUnsavedTimezone(data.timezone); }
          if (data.showTrackPlaycount !== undefined) { setShowTrackPlaycount(data.showTrackPlaycount); setUnsavedShowTrackPlaycount(data.showTrackPlaycount); }
        }
      }).catch(console.error);

      fetchSuggestions();
      fetchApi("/api/user-stats").then(res => res.json()).then(data => { if (data.success) setUserStats(data.stats); }).catch(console.error);
      fetchApi("/api/bot-status").then(res => res.json()).then(data => { if (data.status) setBotStatus(data.status); }).catch(console.error);
    }
  }, [session]);

  const fetchSuggestions = async () => {
    try {
      const res = await fetchApi("/api/suggestions");
      if (res.ok) setSuggestions(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    setHasUnsavedChanges(
      unsavedFmMode !== fmMode ||
      unsavedShowFeatures !== showFeatures ||
      unsavedPrivateMode !== privateMode ||
      unsavedDataSource !== dataSource ||
      unsavedTimezone !== timezone ||
      unsavedShowTrackPlaycount !== showTrackPlaycount
    );
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
        toast.success("Settings saved!");
      }
    } catch (err) {
      toast.error("Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const submitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuggestionTitle.trim() || !newSuggestionDesc.trim()) return;
    setSubmittingSuggestion(true);
    try {
      const res = await fetchApi("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSuggestionTitle, description: newSuggestionDesc })
      });
      if (res.ok) {
        toast.success("Feedback submitted!");
        setNewSuggestionTitle("");
        setNewSuggestionDesc("");
        fetchSuggestions();
      } else {
        toast.error("Failed to submit.");
      }
    } catch (err) {
      toast.error("An error occurred.");
    } finally {
      setSubmittingSuggestion(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const getStatusBadge = (s: string) => {
    switch(s) {
      case 'approved': return <span className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[10px] font-bold uppercase">Approved</span>;
      case 'denied': return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[10px] font-bold uppercase">Denied</span>;
      case 'completed': return <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded text-[10px] font-bold uppercase">Released</span>;
      default: return <span className="px-2 py-0.5 bg-zinc-500/20 text-zinc-400 border border-zinc-500/30 rounded text-[10px] font-bold uppercase">Pending</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col md:flex-row font-sans pt-16 relative">
      {/* Background glowing mesh */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-40">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[120px] mix-blend-screen"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[120px] mix-blend-screen"></div>
      </div>

      {/* Sidebar Layout */}
      <aside className="w-full md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-white/10 bg-zinc-950/50 backdrop-blur-2xl z-10 hidden md:block relative">
        <div className="p-6 sticky top-16">
          <div className="flex items-center gap-3 mb-8">
            <img src={session?.user?.image || "/logo.png"} alt="Avatar" className="w-10 h-10 rounded-full border border-orange-500/30" />
            <div>
              <p className="text-sm font-bold text-white leading-tight">{session?.user?.name}</p>
              <p className="text-xs text-orange-400 font-medium">DJ Dashboard</p>
            </div>
          </div>

          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Menu</h2>
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
              Overview
            </button>
            <button onClick={() => setActiveTab('embed')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'embed' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
              Embed Settings
            </button>
            <button onClick={() => setActiveTab('privacy')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'privacy' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Privacy
            </button>
            <button onClick={() => setActiveTab('feedback')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'feedback' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Feedback
            </button>
          </nav>
        </div>
      </aside>

      {/* Mobile Nav */}
      <div className="md:hidden w-full overflow-x-auto flex gap-2 p-4 border-b border-white/10 bg-zinc-950/50 backdrop-blur-md sticky top-14 z-20 styled-scrollbar">
        <button onClick={() => setActiveTab('overview')} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ${activeTab === 'overview' ? 'bg-orange-500 text-white' : 'bg-white/5 text-zinc-400'}`}>Overview</button>
        <button onClick={() => setActiveTab('embed')} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ${activeTab === 'embed' ? 'bg-orange-500 text-white' : 'bg-white/5 text-zinc-400'}`}>Embed Settings</button>
        <button onClick={() => setActiveTab('privacy')} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ${activeTab === 'privacy' ? 'bg-orange-500 text-white' : 'bg-white/5 text-zinc-400'}`}>Privacy</button>
        <button onClick={() => setActiveTab('feedback')} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ${activeTab === 'feedback' ? 'bg-orange-500 text-white' : 'bg-white/5 text-zinc-400'}`}>Feedback</button>
      </div>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-5xl mx-auto pb-32 z-10 relative">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight capitalize">{activeTab.replace("-", " ")}</h1>
          {botStatus && activeTab === 'overview' && (
            <p className="flex items-center gap-2 text-zinc-400 text-sm mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
              The Goats DJ is currently listening to <strong className="text-white">{botStatus}</strong>
            </p>
          )}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in-up">
            <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden group hover:border-orange-500/20 transition-all">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-500/10 rounded-full blur-[80px] group-hover:bg-orange-500/20 transition-colors"></div>
              <h3 className="text-xl font-bold text-white mb-6">Live Now Playing</h3>
              <NowPlayingWidget />
            </div>

            {userStats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-400 to-red-500"></div>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Total Scrobbles</p>
                  <h4 className="text-4xl font-black text-white">{userStats.playcount.toLocaleString()}</h4>
                </div>
                <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-400 to-pink-500"></div>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-2">Registered On</p>
                  <h4 className="text-xl font-bold text-white mt-2">{new Date(userStats.registered * 1000).toLocaleDateString()}</h4>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'embed' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-2">Command Display Layout</h2>
              <p className="text-zinc-400 text-sm mb-6">Choose how `/fm` commands appear in Discord.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['compact', 'full', 'stats'].map((mode) => (
                  <button 
                    key={mode}
                    onClick={() => setUnsavedFmMode(mode as any)}
                    className={`p-4 rounded-xl border text-left transition-all ${unsavedFmMode === mode ? 'bg-orange-500/10 border-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.15)]' : 'bg-black/20 border-white/5 text-zinc-400 hover:bg-white/5'}`}
                  >
                    <div className="font-bold mb-1 capitalize">{mode} Layout</div>
                    <div className="text-xs opacity-70">
                      {mode === 'compact' && 'Minimal text, small thumbnail. Best for active chats.'}
                      {mode === 'full' && 'Large HD album art with track features. Visually striking.'}
                      {mode === 'stats' && 'Includes your top artists and playcounts inside the embed.'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-6">Embed Details</h2>
              <div className="space-y-6">
                <label className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5 hover:border-white/10 transition-colors cursor-pointer">
                  <div>
                    <div className="font-bold text-white">Show Track Features</div>
                    <div className="text-sm text-zinc-400">Fetch Spotify API to display track tempo, key, and mood.</div>
                  </div>
                  <input type="checkbox" checked={unsavedShowFeatures} onChange={(e) => setUnsavedShowFeatures(e.target.checked)} className="w-5 h-5 rounded border-zinc-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-zinc-900 bg-zinc-900" />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5 hover:border-white/10 transition-colors cursor-pointer">
                  <div>
                    <div className="font-bold text-white">Show Track Playcount</div>
                    <div className="text-sm text-zinc-400">Display how many times you've played the current track in the embed footer.</div>
                  </div>
                  <input type="checkbox" checked={unsavedShowTrackPlaycount} onChange={(e) => setUnsavedShowTrackPlaycount(e.target.checked)} className="w-5 h-5 rounded border-zinc-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-zinc-900 bg-zinc-900" />
                </label>

                <div className="space-y-2">
                  <label className="font-bold text-white">Data Source Priority</label>
                  <p className="text-sm text-zinc-400 mb-2">Prefer Spotify data (HD covers) or Last.fm data (accuracy).</p>
                  <select 
                    value={unsavedDataSource} 
                    onChange={(e) => setUnsavedDataSource(e.target.value as any)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="combined">Combined (Best of both)</option>
                    <option value="spotify">Spotify Only (Max Quality)</option>
                    <option value="lastfm">Last.fm Only (Max Accuracy)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="bg-zinc-900/40 backdrop-blur-xl border border-red-500/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[50px] group-hover:bg-red-500/20 transition-colors"></div>
              <h2 className="text-xl font-bold text-white mb-2">Privacy & Visibility</h2>
              <p className="text-zinc-400 text-sm mb-6">Control who can see your listening data.</p>
              
              <label className="flex items-center justify-between p-5 rounded-xl bg-black/30 border border-red-500/20 hover:border-red-500/40 transition-colors cursor-pointer">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    Private Mode <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] uppercase tracking-wider">Strict</span>
                  </div>
                  <div className="text-sm text-zinc-400 mt-1">If enabled, other users cannot use `/fm user:@you` to check your stats.</div>
                </div>
                <input type="checkbox" checked={unsavedPrivateMode} onChange={(e) => setUnsavedPrivateMode(e.target.checked)} className="w-5 h-5 rounded border-red-900 text-red-500 focus:ring-red-500 focus:ring-offset-zinc-900 bg-zinc-900" />
              </label>

              <div className="mt-8 space-y-2">
                <label className="font-bold text-white">Timezone</label>
                <p className="text-sm text-zinc-400 mb-2">Used for daily and weekly stat calculations.</p>
                <select 
                  value={unsavedTimezone} 
                  onChange={(e) => setUnsavedTimezone(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="UTC">UTC (Default)</option>
                  <option value="America/New_York">Eastern Time (US)</option>
                  <option value="America/Chicago">Central Time (US)</option>
                  <option value="America/Denver">Mountain Time (US)</option>
                  <option value="America/Los_Angeles">Pacific Time (US)</option>
                  <option value="Europe/London">London (UK)</option>
                  <option value="Europe/Paris">Central European Time</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up">
            <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl h-fit">
              <h2 className="text-xl font-bold text-white mb-2">Submit Feedback</h2>
              <p className="text-zinc-400 text-sm mb-6">Have an idea for the bot or found a bug? Let us know!</p>
              
              <form onSubmit={submitSuggestion} className="space-y-4">
                <div>
                  <input 
                    type="text" 
                    placeholder="Short Title (e.g. Add genre tags)" 
                    value={newSuggestionTitle}
                    onChange={(e) => setNewSuggestionTitle(e.target.value)}
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
                <div>
                  <textarea 
                    placeholder="Describe your idea or the bug in detail..." 
                    value={newSuggestionDesc}
                    onChange={(e) => setNewSuggestionDesc(e.target.value)}
                    required
                    rows={4}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                  ></textarea>
                </div>
                <button 
                  type="submit" 
                  disabled={submittingSuggestion || !newSuggestionTitle || !newSuggestionDesc}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all"
                >
                  {submittingSuggestion ? "Submitting..." : "Send Feedback"}
                </button>
              </form>
            </div>

            <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-6">Your Suggestions</h2>
              <div className="space-y-4">
                {suggestions.filter(s => s.discord_id === (session.user as any)?.id).length === 0 ? (
                  <div className="text-center text-zinc-500 text-sm italic p-8 bg-black/20 rounded-xl border border-white/5">
                    You haven't submitted any feedback yet.
                  </div>
                ) : (
                  suggestions.filter(s => s.discord_id === (session.user as any)?.id).map(s => (
                    <div key={s.id} className="p-5 rounded-2xl bg-black/30 border border-white/5">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-white">{s.title}</h4>
                        {getStatusBadge(s.status)}
                      </div>
                      <p className="text-sm text-zinc-400 mb-3">{s.description}</p>
                      {s.admin_feedback && (
                        <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                          <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-1">Developer Reply</p>
                          <p className="text-sm text-orange-100">{s.admin_feedback}</p>
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

      {/* Unsaved Changes Banner */}
      <div className={`fixed bottom-0 left-0 right-0 p-4 z-50 transition-transform duration-500 ${hasUnsavedChanges ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="max-w-3xl mx-auto bg-zinc-900/90 backdrop-blur-2xl border border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-white font-bold text-lg">Careful — you have unsaved changes!</h4>
            <p className="text-zinc-400 text-sm">Don't forget to save your settings before leaving this tab.</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              onClick={() => {
                setUnsavedFmMode(fmMode);
                setUnsavedShowFeatures(showFeatures);
                setUnsavedPrivateMode(privateMode);
                setUnsavedDataSource(dataSource);
                setUnsavedTimezone(timezone);
                setUnsavedShowTrackPlaycount(showTrackPlaycount);
              }}
              className="px-6 py-2.5 rounded-xl font-bold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors flex-1 sm:flex-none"
            >
              Reset
            </button>
            <button 
              onClick={saveSettings}
              disabled={savingSettings}
              className="px-6 py-2.5 rounded-xl font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all flex-1 sm:flex-none"
            >
              {savingSettings ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
