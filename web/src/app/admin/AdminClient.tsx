"use client";
import { fetchApi } from '@/lib/fetchApi';
import { toast } from 'react-hot-toast';
import { useState, useEffect } from "react";
import { useSession } from "@/app/providers";

function AdminActionCard({ title, description, actionType, icon, colorClass }: any) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleAction = async () => {
    setLoading(true);
    setStatus("idle");
    try {
      const res = await fetchApi("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType }),
      });
      if (res.ok) {
        setStatus("success");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
      }
    } catch (e) {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const getButtonClass = () => {
    if (status === "success") return "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]";
    if (status === "error") return "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]";
    return `bg-${colorClass}-500/10 hover:bg-${colorClass}-500/20 text-${colorClass}-400 border border-${colorClass}-500/30 hover:border-${colorClass}-500/50`;
  };

  return (
    <div className={`bg-zinc-950/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:border-${colorClass}-500/30 transition-all duration-300 group flex flex-col justify-between shadow-xl`}>
      <div>
        <div className={`w-14 h-14 rounded-2xl bg-${colorClass}-500/10 border border-${colorClass}-500/20 text-${colorClass}-400 flex items-center justify-center mb-6 shadow-inner`}>
          {icon}
        </div>
        <h3 className="text-white font-bold text-xl mb-2">{title}</h3>
        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">{description}</p>
      </div>
      <button
        onClick={handleAction}
        disabled={loading}
        className={`w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-300 flex justify-center items-center gap-2 ${getButtonClass()}`}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Executing...
          </span>
        ) : status === "success" ? "Operation Successful" : status === "error" ? "Action Failed" : "Execute Action"}
      </button>
    </div>
  );
}

function PushGlobalUpdateCard() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [version, setVersion] = useState("v1.0.0");
  const [content, setContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [commits, setCommits] = useState<any[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);
  const [selectedShas, setSelectedShas] = useState<string[]>([]);

  const fetchCommits = () => {
    setCommitsLoading(true);
    fetch("https://api.github.com/repos/GamerNation12/The-Goats-Dj/commits")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCommits(data.slice(0, 10)); // Top 10 commits
        }
      })
      .catch(console.error)
      .finally(() => setCommitsLoading(false));
  };

  useEffect(() => {
    fetchCommits();
    const interval = setInterval(fetchCommits, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleCommitSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions);
    const shas = options.map(o => o.value);
    setSelectedShas(shas);

    if (shas.length > 0) {
      const latestSha = shas[0].substring(0, 7);
      setVersion(`v-${latestSha}`);

      const combinedMessages = shas.map(sha => {
        const commit = commits.find(c => c.sha === sha);
        return commit ? `- ${commit.commit.message.split('\n')[0]}` : "";
      }).join('\n');

      setContent(`🎉 **The Goats DJ Update \`v-${latestSha}\`** 🎉\n\n${combinedMessages}\n\n*(You can disable these update notifications in /settings)*`);
    } else {
      setContent("");
      setVersion("");
    }
  };

  const handleEnhanceWithAI = async () => {
    if (!content) return;
    setAiLoading(true);
    try {
      const res = await fetchApi("/api/admin/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      if (res.ok) {
        const data = await res.json();
        setContent(`🎉 **The Goats DJ Update \`${version}\`** 🎉\n\n${data.result}`);
      } else {
        const errData = await res.json();
        toast.error(`AI Error: ${errData.error || "Something went wrong"}`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to connect to the AI service.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSend = async () => {
    if (!version || !content) return;
    setLoading(true);
    setStatus("idle");
    try {
      const res = await fetchApi("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          actionType: "SET_GLOBAL_UPDATE",
          payload: { 
            version,
            message: content
          }
        }),
      });
      if (res.ok) {
        setStatus("success");
        toast.success("Global update pushed successfully!");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
        toast.error("Failed to push update");
        setTimeout(() => setStatus("idle"), 3000);
      }
    } catch (e) {
      setStatus("error");
      toast.error("An error occurred while pushing the update");
    } finally {
      setLoading(false);
    }
  };

  const renderContent = (text: string) => {
    let parsedText = text.replace(/<t:\d+:R>/g, "Just now");
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(parsedText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(parsedText.substring(lastIndex, match.index));
      }
      parts.push(
        <a key={match.index} href={match[2]} target="_blank" rel="noreferrer" className="text-[#00a8fc] hover:underline cursor-pointer">
          {match[1]}
        </a>
      );
      lastIndex = linkRegex.lastIndex;
    }
    if (lastIndex < parsedText.length) {
      parts.push(parsedText.substring(lastIndex));
    }
    return parts;
  };

  return (
    <div className="bg-zinc-950/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 hover:border-indigo-500/30 transition-all duration-300 shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        </div>
        <div>
          <h3 className="text-white font-bold text-lg">Push Global Update</h3>
          <p className="text-zinc-400 text-xs">Update the bot's global notification system.</p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wider">Fetch from GitHub</label>
          <select 
            multiple
            onChange={handleCommitSelect}
            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer min-h-[120px] custom-scrollbar"
            value={selectedShas}
          >
            {commits.map(c => (
              <option key={c.sha} value={c.sha} className="py-1.5 px-2 mb-1 hover:bg-zinc-800 rounded checked:bg-indigo-500/20 checked:text-indigo-300">
                {c.commit.message.split('\n')[0].substring(0, 60)}...
              </option>
            ))}
          </select>
          <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">Hold Ctrl/Cmd to select multiple commits</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wider">Version ID</label>
          <input 
            type="text" 
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="e.g. v1.2.0"
            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div>
          <div className="flex justify-between items-end mb-1">
            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">Message Content</label>
            <button 
              onClick={handleEnhanceWithAI}
              disabled={aiLoading || !content}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded-md"
            >
              {aiLoading ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : "✨ Enhance with AI"}
            </button>
          </div>
          <textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write the update details here..."
            rows={8}
            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-y"
          />
        </div>

        <div className="mt-4 pt-4 border-t border-white/10">
          <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Discord Message Preview</label>
          <div className="bg-[#313338] rounded-md p-4 max-w-full">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#1e1f22] flex items-center justify-center border border-[#1e1f22] overflow-hidden">
                <span className="text-2xl">🐐</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium text-[15px] hover:underline cursor-pointer">The Goats DJ</span>
                  <span className="bg-[#5865F2] text-white text-[10px] px-1.5 py-0.5 rounded flex items-center font-bold">
                    <svg className="w-3 h-3 mr-0.5" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M7.39999 1.7L3.39999 5.8L7.39999 9.8L8.79999 8.3L6.19999 5.8L8.79999 3.2L7.39999 1.7Z" />
                      <path d="M11.8 1.7L7.80005 5.8L11.8 9.8L13.2 8.3L10.6 5.8L13.2 3.2L11.8 1.7Z" />
                    </svg>
                    APP
                  </span>
                  <span className="text-[#949BA4] text-xs">Today at 12:00 PM</span>
                </div>
                <div className="text-[#dbdee1] text-[15px] whitespace-pre-wrap leading-relaxed mt-1">
                  {renderContent(content || "Description")}
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSend}
          disabled={loading || !version || !content}
          className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all duration-300 flex justify-center items-center gap-2 ${
            status === "success" ? "bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]" :
            status === "error" ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]" :
            "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:border-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Pushing Update...
            </span>
          ) : status === "success" ? "Pushed!" : status === "error" ? "Failed" : "Push Update Notification"}
        </button>
      </div>
    </div>
  );
}

export default function AdminClient() {
  const { data: session } = useSession();
  const [statsData, setStatsData] = useState<any>({ totalPlays: 0, totalUsers: 0, botStats: null, commandUsage: [] });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (session && (session.user as any)?.id === "759433582107426816") {
      fetchApi("/api/admin/stats")
        .then(res => res.json())
        .then(data => {
          if (!data.error) setStatsData(data);
          setStatsLoading(false);
        })
        .catch(err => {
          console.error(err);
          setStatsLoading(false);
        });
    }
  }, [session]);

  
  const [activeTab, setActiveTab] = useState<"dashboard" | "suggestions">("dashboard");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [editingSuggestion, setEditingSuggestion] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("pending");
  const [editFeedback, setEditFeedback] = useState("");

  useEffect(() => {
    if (activeTab === "suggestions") {
      fetchSuggestions();
    }
  }, [activeTab]);

  const fetchSuggestions = async () => {
    try {
      const res = await fetchApi("/api/suggestions");
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveSuggestionUpdate = async (id: string) => {
    try {
      const res = await fetchApi(`/api/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus, admin_feedback: editFeedback })
      });
      if (res.ok) {
        setEditingSuggestion(null);
        fetchSuggestions();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!session || (session.user as any)?.id !== "759433582107426816") {
    return null;
  }

  const { totalPlays, totalUsers, botStats, commandUsage } = statsData;
  const servers = botStats?.servers || [];

  const StatCard = ({ title, value, icon, color }: any) => (
    <div className="bg-zinc-950/50 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
      <div className={`absolute -right-6 -top-6 w-24 h-24 bg-${color}-500/10 rounded-full blur-2xl group-hover:bg-${color}-500/20 transition-colors`}></div>
      <div className="flex items-start justify-between relative z-10">
        <div>
          <h3 className="text-zinc-500 font-semibold mb-1 text-sm uppercase tracking-wider">{title}</h3>
          <p className="text-4xl font-black text-white">{value}</p>
        </div>
        <div className={`text-${color}-400 text-2xl bg-${color}-500/10 p-3 rounded-2xl`}>
          {icon}
        </div>
      </div>
    </div>
  );

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'approved': return <span className="px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Approved</span>;
      case 'denied': return <span className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Denied</span>;
      case 'completed': return <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Update Released</span>;
      default: return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-xs font-bold uppercase tracking-wider">Pending</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8 font-sans animate-fade-in-up relative">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
      
      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-br from-white via-indigo-200 to-indigo-500 bg-clip-text text-transparent inline-block pb-1 tracking-tight">
              Command Center
            </h1>
            <p className="text-zinc-400 mt-2 text-lg">System analytics and administrative controls.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full md:w-auto">
            <button 
              onClick={() => setActiveTab("dashboard")}
              className={`w-full sm:w-auto px-4 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
            >
              Overview
            </button>
            <button 
              onClick={() => setActiveTab("suggestions")}
              className={`w-full sm:w-auto px-4 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'suggestions' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
            >
              Manage Suggestions
            </button>
          </div>
        </header>

        {activeTab === "dashboard" && (
          <>
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total Scrobbles" value={totalPlays.toLocaleString()} icon="🎵" color="indigo" />
              <StatCard title="Imported Users" value={totalUsers.toLocaleString()} icon="👥" color="purple" />
              <StatCard title="Active Servers" value={botStats?.server_count || 0} icon="🖥️" color="emerald" />
              <StatCard title="Total Members" value={botStats?.member_count?.toLocaleString() || 0} icon="🌐" color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Quick Actions */}
              <div className="lg:col-span-1 space-y-6">
                <h2 className="text-2xl font-bold text-white pl-2 border-l-4 border-indigo-500">System Actions</h2>
                
                <AdminActionCard 
                  title="Sync Global Commands"
                  description="Push the latest slash command definitions to Discord's global registry."
                  actionType="SYNC_COMMANDS"
                  colorClass="indigo"
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  }
                />

                <AdminActionCard 
                  title="Restart Bot Process"
                  description="Safely reboot the Python bot instance running on Pterodactyl."
                  actionType="RESTART_BOT"
                  colorClass="red"
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />

                <PushGlobalUpdateCard />
              </div>

              {/* Tables */}
              <div className="lg:col-span-2 space-y-8">
                {/* Top Commands */}
                <div className="bg-zinc-950/50 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                    <h2 className="text-xl font-bold text-white">Command Analytics</h2>
                    <p className="text-zinc-500 text-sm mt-1">Most frequently executed slash commands.</p>
                  </div>
                  <div className="p-6">
                    {commandUsage.length > 0 ? (
                      <div className="space-y-3">
                        {commandUsage.map((cmd: any, i: number) => (
                          <div key={cmd.command_name} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-white/5 hover:bg-zinc-900 transition-colors">
                            <div className="flex items-center gap-4">
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-zinc-300/20 text-zinc-300' : i === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-white/5 text-zinc-500'}`}>
                                {i + 1}
                              </span>
                              <span className="text-indigo-300 font-mono font-bold text-lg">/{cmd.command_name}</span>
                            </div>
                            <span className="text-zinc-300 font-semibold bg-white/5 px-4 py-1.5 rounded-full text-sm">
                              {cmd.usage_count.toLocaleString()} uses
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-zinc-500 italic border border-dashed border-white/10 rounded-2xl">
                        No commands tracked yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Server List */}
                <div className="bg-zinc-950/50 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-white">Active Guilds</h2>
                      <p className="text-zinc-500 text-sm mt-1">Largest servers currently connected.</p>
                    </div>
                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-bold tracking-wider text-zinc-400 uppercase">
                      Top 10
                    </span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {servers.slice(0, 10).map((server: any) => (
                      <div key={server.name} className="p-5 hover:bg-white/[0.02] transition-colors flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {server.icon ? (
                            <img src={server.icon} alt={server.name} className="w-12 h-12 rounded-full border border-white/10 shadow-lg" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold border border-white/5 shadow-lg">
                              {server.name.charAt(0)}
                            </div>
                          )}
                          <span className="font-bold text-zinc-200 text-lg">{server.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-zinc-400 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">
                          {server.member_count.toLocaleString()} members
                        </span>
                      </div>
                    ))}
                    {servers.length === 0 && (
                      <div className="p-8 text-center text-zinc-500 italic">
                        No servers found or bot stats not pushed yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "suggestions" && (
          <div className="bg-zinc-950/50 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Manage User Feedback</h2>
                <p className="text-zinc-400 text-sm mt-1">Approve ideas, leave feedback, and notify users of updates.</p>
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {suggestions.length === 0 ? (
                <div className="p-12 text-center text-zinc-500 text-lg">No suggestions yet.</div>
              ) : (
                suggestions.map((s) => (
                  <div key={s.id} className="p-8 hover:bg-white/[0.01] transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xl font-bold text-white">{s.title}</span>
                          {getStatusBadge(s.status)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-500">
                          <span className="text-indigo-400 font-semibold">{s.username}</span>
                          <span>•</span>
                          <span>{new Date(s.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      
                      {editingSuggestion !== s.id && (
                        <button 
                          onClick={() => {
                            setEditingSuggestion(s.id);
                            setEditStatus(s.status);
                            setEditFeedback(s.admin_feedback || "");
                          }}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-bold transition-all"
                        >
                          Review & Reply
                        </button>
                      )}
                    </div>
                    
                    <div className="bg-zinc-900/50 border border-white/5 p-5 rounded-xl text-zinc-300 leading-relaxed mb-4">
                      {s.description}
                    </div>

                    {s.admin_feedback && editingSuggestion !== s.id && (
                      <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl relative ml-6">
                        <div className="absolute -left-1.5 top-6 w-3 h-3 bg-indigo-500 rotate-45 border-l border-t border-indigo-500/20"></div>
                        <h5 className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">Your Reply</h5>
                        <p className="text-indigo-100 text-sm">{s.admin_feedback}</p>
                      </div>
                    )}

                    {editingSuggestion === s.id && (
                      <div className="bg-zinc-900 border border-indigo-500/30 p-6 rounded-2xl mt-6 shadow-2xl">
                        <h4 className="text-lg font-bold mb-4">Update Status & Reply</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-semibold text-zinc-400 mb-2">Status</label>
                            <select 
                              value={editStatus} 
                              onChange={(e) => setEditStatus(e.target.value)}
                              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                            >
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="denied">Denied</option>
                              <option value="completed">Update Released</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-zinc-400 mb-2">Feedback to User (Optional)</label>
                            <textarea 
                              value={editFeedback} 
                              onChange={(e) => setEditFeedback(e.target.value)}
                              placeholder="e.g., We're working on this now! It will be in the next update."
                              rows={3}
                              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                          <button 
                            onClick={() => setEditingSuggestion(null)}
                            className="px-6 py-2 text-zinc-400 hover:text-white font-semibold transition-colors"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => saveSuggestionUpdate(s.id)}
                            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all"
                          >
                            Save Update
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
