"use client";
import { fetchApi } from "@/lib/fetchApi";

import { useSession } from "@/app/providers";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
  
  // Unsaved Changes State
  const [unsavedFmMode, setUnsavedFmMode] = useState<"compact" | "full" | "stats">("full");
  const [unsavedShowFeatures, setUnsavedShowFeatures] = useState<boolean>(false);
  const [unsavedPrivateMode, setUnsavedPrivateMode] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Suggestions State
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [newSuggestionTitle, setNewSuggestionTitle] = useState("");
  const [newSuggestionDesc, setNewSuggestionDesc] = useState("");
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  useEffect(() => {
    if (session) {
      // Fetch Settings
      fetchApi("/api/settings")
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            if (data.fmMode) { setFmMode(data.fmMode); setUnsavedFmMode(data.fmMode); }
            if (data.showFeatures !== undefined) { setShowFeatures(data.showFeatures); setUnsavedShowFeatures(data.showFeatures); }
            if (data.privateMode !== undefined) { setPrivateMode(data.privateMode); setUnsavedPrivateMode(data.privateMode); }
          }
        })
        .catch((err) => console.error("Error fetching settings:", err));

      // Fetch Suggestions
      fetchSuggestions();
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

  // Check for unsaved changes
  useEffect(() => {
    if (
      unsavedFmMode !== fmMode ||
      unsavedShowFeatures !== showFeatures ||
      unsavedPrivateMode !== privateMode
    ) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [unsavedFmMode, unsavedShowFeatures, unsavedPrivateMode, fmMode, showFeatures, privateMode]);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetchApi("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fmMode: unsavedFmMode,
          showFeatures: unsavedShowFeatures,
          privateMode: unsavedPrivateMode
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fmMode) setFmMode(data.fmMode);
        if (data.showFeatures !== undefined) setShowFeatures(data.showFeatures);
        if (data.privateMode !== undefined) setPrivateMode(data.privateMode);
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
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/75 ${checked ? 'bg-indigo-500' : 'bg-zinc-800'}`}
    >
      <span className="sr-only">Toggle</span>
      <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

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
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden relative pb-24">
      <div className="fixed top-0 left-1/4 w-1/2 h-[500px] bg-indigo-600/5 rounded-full blur-[150px] pointer-events-none z-0" />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-32 relative z-10 max-w-7xl animate-fade-in-up">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
            Dashboard
          </h1>
          <p className="text-zinc-400 text-lg">Manage your account and preferences.</p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Side Nav */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-zinc-950/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
                <img 
                  src={session?.user?.image || "/logo.png"} 
                  alt="Avatar" 
                  className="w-16 h-16 rounded-full border border-zinc-800 shadow-xl"
                />
                <div>
                  <h2 className="font-bold text-lg leading-tight">{session?.user?.name}</h2>
                  <p className="text-zinc-500 text-xs mt-1">Discord User</p>
                </div>
              </div>
              <div className="space-y-2">
                <button 
                  onClick={() => setActiveTab("settings")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
                >
                  ⚙️ Preferences
                </button>
                <button 
                  onClick={() => setActiveTab("suggestions")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'suggestions' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
                >
                  💡 Feedback & Ideas
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            
            {activeTab === "settings" && (
              <>
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
                          onClick={() => setUnsavedFmMode(mode.id as any)}
                          className={`relative flex flex-col items-start p-6 rounded-2xl border transition-all duration-300 text-left ${
                            unsavedFmMode === mode.id
                              ? "bg-indigo-500/10 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.1)]"
                              : "bg-zinc-900/50 border-white/5 hover:border-white/20 hover:bg-zinc-900"
                          }`}
                        >
                          <div className="text-2xl mb-4">{mode.icon}</div>
                          <div className={`text-lg font-bold ${unsavedFmMode === mode.id ? 'text-indigo-300' : 'text-white'}`}>{mode.title}</div>
                          <div className="text-sm text-zinc-500 mt-1">{mode.desc}</div>
                          
                          {/* Selection Indicator */}
                          <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${unsavedFmMode === mode.id ? 'border-indigo-500' : 'border-zinc-700'}`}>
                            {unsavedFmMode === mode.id && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full"></div>}
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
                    <div className="p-8 flex items-center justify-between">
                      <div className="pr-8">
                        <div className="text-lg font-semibold text-white mb-1">Show Featured Artists</div>
                        <div className="text-sm text-zinc-400 leading-relaxed max-w-xl">
                          Automatically extract featured artists from the track name and display them distinctly.
                        </div>
                      </div>
                      <ToggleSwitch checked={unsavedShowFeatures} onChange={() => setUnsavedShowFeatures(!unsavedShowFeatures)} />
                    </div>

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
                      <ToggleSwitch checked={unsavedPrivateMode} onChange={() => setUnsavedPrivateMode(!unsavedPrivateMode)} />
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === "suggestions" && (
              <>
                {/* Submit Suggestion Card */}
                <div className="bg-zinc-950/50 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02]">
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
                        className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
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
                        className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={submittingSuggestion}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50 flex items-center gap-2"
                    >
                      {submittingSuggestion ? "Submitting..." : "Send Suggestion"}
                    </button>
                  </form>
                </div>

                {/* My Suggestions List */}
                <div className="bg-zinc-950/50 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02]">
                    <h3 className="text-xl font-bold">My Submissions</h3>
                    <p className="text-zinc-400 text-sm mt-1">Track the status of your ideas submitted from Discord or the Web.</p>
                  </div>
                  <div className="divide-y divide-white/5">
                    {suggestionsLoading ? (
                      <div className="p-8 text-center text-zinc-500">Loading...</div>
                    ) : suggestions.length === 0 ? (
                      <div className="p-8 text-center text-zinc-500 italic">You haven't submitted any suggestions yet.</div>
                    ) : (
                      suggestions.map((s) => (
                        <div key={s.id} className="p-8">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="text-lg font-bold text-white">{s.title}</h4>
                              <p className="text-xs text-zinc-500 mt-1">{new Date(s.created_at).toLocaleString()}</p>
                            </div>
                            {getStatusBadge(s.status)}
                          </div>
                          <p className="text-zinc-400 text-sm mb-4 leading-relaxed bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                            {s.description}
                          </p>
                          {s.admin_feedback && (
                            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl relative">
                              <div className="absolute -left-1.5 top-6 w-3 h-3 bg-indigo-500 rotate-45 border-l border-t border-indigo-500/20"></div>
                              <h5 className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">Developer Reply</h5>
                              <p className="text-indigo-100 text-sm">{s.admin_feedback}</p>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      </main>

      {/* Floating Save Bar */}
      <div className={`fixed bottom-0 left-0 w-full p-6 transition-all duration-500 z-50 ${hasUnsavedChanges ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
        <div className="max-w-2xl mx-auto bg-zinc-900/90 backdrop-blur-xl border border-indigo-500/30 p-4 rounded-2xl shadow-[0_-10px_40px_rgba(99,102,241,0.2)] flex items-center justify-between">
          <div className="text-indigo-100 font-medium">You have unsaved changes!</div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                setUnsavedFmMode(fmMode);
                setUnsavedShowFeatures(showFeatures);
                setUnsavedPrivateMode(privateMode);
              }}
              className="px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              Discard
            </button>
            <button 
              onClick={saveSettings}
              disabled={savingSettings}
              className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] disabled:opacity-50"
            >
              {savingSettings ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
