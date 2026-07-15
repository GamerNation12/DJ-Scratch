"use client";
import { fetchApi } from '@/lib/fetchApi';
import { toast } from 'react-hot-toast';
import { useState, useEffect } from "react";
import { useSession } from "@/app/providers";
import AdminTerminal from "./AdminTerminal";
import AdminChatLogs from "./AdminChatLogs";

function AdminActionCard({ title, description, actionType, icon, colorClass }: any) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleAction = async () => {
    setLoading(true);
    setStatus("idle");
    try {
      if (actionType === "RENEW_HOST_SERVER") {
        // Open the FPS panel in a small popup window
        window.open(
          "https://panel.fps.ms/server/5be081c1-6d0b-4d6e-87d8-c51a5cfb652f",
          "RenewServer",
          "width=800,height=600,left=200,top=200"
        );
        setStatus("success");
        setTimeout(() => setStatus("idle"), 3000);
        setLoading(false);
        return;
      }

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
    <div className={`bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:border-${colorClass}-500/30 transition-all duration-300 flex flex-col justify-between shadow-lg`}>
      <div>
        <div className={`w-12 h-12 rounded-xl bg-${colorClass}-500/10 border border-${colorClass}-500/20 text-${colorClass}-400 flex items-center justify-center mb-4`}>
          {icon}
        </div>
        <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
        <p className="text-zinc-400 text-sm mb-6 leading-relaxed">{description}</p>
      </div>
      <button
        onClick={handleAction}
        disabled={loading}
        className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all duration-300 flex justify-center items-center gap-2 ${getButtonClass()}`}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </span>
        ) : status === "success" ? "Success" : status === "error" ? "Failed" : "Execute"}
      </button>
    </div>
  );
}

const tagColors: Record<string, { bg: string, text: string, name: string }> = {
  feat: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', name: '✨ New Feature' },
  fix: { bg: 'bg-red-500/20', text: 'text-red-400', name: '🐛 Bug Fix' },
  chore: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', name: '🔧 Chore' },
  refactor: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', name: '♻️ Refactor' },
  docs: { bg: 'bg-blue-500/20', text: 'text-blue-400', name: '📚 Docs' },
};

function getCommitInfo(message: string) {
  const match = message.match(/^(feat|fix|fixed bug|chore|docs|refactor|style|test)(\(.*?\))?:/i);
  if (match) {
    const type = match[1].toLowerCase();
    const typeClean = type === 'fixed bug' ? 'fix' : type;
    const body = message.slice(match[0].length).trim();
    return { type: typeClean, body };
  }
  return { type: null, body: message };
}

function PushGlobalUpdateCard() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [version, setVersion] = useState("");
  const [content, setContent] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [commits, setCommits] = useState<any[]>([]);

  const [selectedShas, setSelectedShas] = useState<string[]>([]);

  const fetchCommits = () => {
    fetch("https://api.github.com/repos/GamerNation12/DJ-Scratch/commits")
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setCommits(data.slice(0, 10)); })
      .catch(console.error);
  };

  useEffect(() => {
    fetchCommits();
    const interval = setInterval(fetchCommits, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleCommit = (sha: string) => {
    setSelectedShas(prev => {
      const newShas = prev.includes(sha) ? prev.filter(s => s !== sha) : [...prev, sha];
      
      if (newShas.length > 0) {
        // Find selected commits in order of appearance in commits array
        const selectedCommits = commits.filter(c => newShas.includes(c.sha));
        if (selectedCommits.length > 0) {
          const combinedMessages = selectedCommits.map(c => {
            const msgLine = c.commit.message.split('\n')[0];
            const info = getCommitInfo(msgLine);
            if (info.type && tagColors[info.type]) {
              return `- ${tagColors[info.type].name}: ${info.body}`;
            }
            return `- ${msgLine}`;
          }).join('\n');
          setContent(combinedMessages);
        }
      } else {
        setContent("");
        setVersion("");
      }
      return newShas;
    });
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
        setContent(data.result);
      } else {
        toast.error("AI Error");
      }
    } catch (e) {
      toast.error("AI service failed.");
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
        body: JSON.stringify({ actionType: "SET_GLOBAL_UPDATE", payload: { version, message: content } })
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

  return (
    <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">🚀</div>
        <h3 className="text-white font-bold text-lg">Push Global Update</h3>
      </div>
      <div className="space-y-4">
        <div className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2 max-h-48 overflow-y-auto space-y-1">
          {commits.map(c => {
            const info = getCommitInfo(c.commit.message.split('\n')[0]);
            const isSelected = selectedShas.includes(c.sha);
            const tag = info.type && tagColors[info.type] ? tagColors[info.type] : null;
            
            return (
              <div 
                key={c.sha} 
                onClick={() => toggleCommit(c.sha)}
                className={`p-2 rounded-lg cursor-pointer flex items-center gap-3 transition-colors ${isSelected ? 'bg-indigo-500/20 border border-indigo-500/30' : 'hover:bg-white/5 border border-transparent'}`}
              >
                <span className="text-zinc-500 font-mono text-xs">{c.sha.substring(0,7)}</span>
                {tag && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${tag.bg} ${tag.text}`}>
                    {tag.name.replace(/[^a-zA-Z ]/g, '').trim()}
                  </span>
                )}
                <span className="text-zinc-300 text-sm truncate flex-1">{info.body}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input type="text" value={version} onChange={e => setVersion(e.target.value)} placeholder="Version (e.g. v2.1.0)" className="w-1/3 bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          <button onClick={handleEnhanceWithAI} disabled={aiLoading || !content} className="w-2/3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg px-3 py-2 text-sm font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50">
            {aiLoading ? "Generating..." : "✨ Enhance with AI"}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setContent(prev => prev + "✨ **New Feature:** ")} className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded hover:bg-emerald-500/30 transition-colors">✨ Feature</button>
          <button onClick={() => setContent(prev => prev + "🐛 **Bug Fix:** ")} className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded hover:bg-red-500/30 transition-colors">🐛 Bug Fix</button>
          <button onClick={() => setContent(prev => prev + "🔧 **Update:** ")} className="text-xs bg-zinc-500/20 text-zinc-400 border border-zinc-500/30 px-2 py-1 rounded hover:bg-zinc-500/30 transition-colors">🔧 Update</button>
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Update message..." rows={6} className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono" />
        <button onClick={handleSend} disabled={loading || !version || !content} className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${status === 'success' ? 'bg-emerald-500 text-white' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'}`}>
          {loading ? "Pushing..." : status === "success" ? "Pushed!" : "Push Notification"}
        </button>
      </div>
    </div>
  );
}

export default function AdminClient() {
  const { data: session } = useSession();
  const [role, setRole] = useState<string | null>(null);
  const [statsData, setStatsData] = useState<any>({ totalPlays: 0, totalUsers: 0, botStats: null, commandUsage: [] });
  const [loadingStats, setLoadingStats] = useState(true);
  
  const [activeTab, setActiveTab] = useState("overview");

  // Access Control State
  const [adminUsers, setAdminUsers] = useState<any>({ admins: [], moderators: [] });
  const [newAdminId, setNewAdminId] = useState("");
  const [newAdminRole, setNewAdminRole] = useState("admin");
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // Suggestions State
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [editingSuggestion, setEditingSuggestion] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("pending");
  const [editFeedback, setEditFeedback] = useState("");

  useEffect(() => {
    if (session) {
      fetchApi("/api/admin/check")
        .then(res => res.json())
        .then(data => {
          if (data.role) {
            setRole(data.role);
            fetchStats();
            if (data.role === 'owner') fetchAdmins();
          } else {
            setRole("unauthorized");
          }
        })
        .catch(err => {
          console.error("Admin check failed", err);
          setRole("error");
        });
    }
  }, [session]);

  useEffect(() => {
    if (activeTab === "suggestions") fetchSuggestions();
    if (activeTab === "users" || activeTab === "permissions") fetchUsersList();
    if (activeTab === "permissions") fetchPermissionsList();
  }, [activeTab]);

  // Permissions State
  const [permissionsList, setPermissionsList] = useState<any[]>([]);
  const [permUserId, setPermUserId] = useState("");
  const [permCommand, setPermCommand] = useState("restart");
  const [loadingPerms, setLoadingPerms] = useState(false);
  
  const fetchPermissionsList = async () => {
    setLoadingPerms(true);
    try {
      const res = await fetchApi("/api/admin/permissions");
      if (res.ok) {
        const data = await res.json();
        setPermissionsList(data);
      }
    } finally {
      setLoadingPerms(false);
    }
  };

  const handleGrantPermission = async () => {
    if (!permUserId || !permCommand) return;
    try {
      const res = await fetchApi("/api/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: permUserId, commandName: permCommand })
      });
      if (res.ok) {
        toast.success("Permission granted!");
        fetchPermissionsList();
        setPermUserId("");
      } else toast.error("Failed to grant");
    } catch {
      toast.error("Error granting permission");
    }
  };

  const handleRevokePermission = async (userId: string, commandName: string) => {
    try {
      const res = await fetchApi("/api/admin/permissions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, commandName })
      });
      if (res.ok) {
        toast.success("Permission revoked!");
        fetchPermissionsList();
      } else toast.error("Failed to revoke");
    } catch {
      toast.error("Error revoking permission");
    }
  };


  // User Management State
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  const fetchUsersList = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetchApi("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        if (data.users) setUsersList(data.users);
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUserAction = async (userId: string, actionType: string, payload: any = {}) => {
    try {
      const res = await fetchApi("/api/admin/users/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, actionType, payload })
      });
      if (res.ok) {
        toast.success("User action successful");
        fetchUsersList();
      } else {
        toast.error("User action failed");
      }
    } catch (e) {
      toast.error("Error executing user action");
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetchApi("/api/admin/stats");
      if (res.ok) setStatsData(await res.json());
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await fetchApi("/api/admin/access");
      if (res.ok) setAdminUsers(await res.json());
    } catch(e) { console.error(e); }
  };

  const fetchSuggestions = async () => {
    try {
      const res = await fetchApi("/api/suggestions");
      if (res.ok) setSuggestions(await res.json());
    } catch (e) { console.error(e); }
  };

  const addAdmin = async () => {
    if (!newAdminId) return;
    setLoadingAdmins(true);
    try {
      const res = await fetchApi("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newAdminId, role: newAdminRole })
      });
      if (res.ok) {
        toast.success("Admin added successfully!");
        setNewAdminId("");
        fetchAdmins();
      } else {
        toast.error("Failed to add admin");
      }
    } finally {
      setLoadingAdmins(false);
    }
  };

  const removeAdmin = async (id: string) => {
    try {
      const res = await fetchApi("/api/admin/access", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        toast.success("Admin removed!");
        fetchAdmins();
      }
    } catch(e) { toast.error("Error removing admin"); }
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
    } catch (e) {}
  };

  if (role === "unauthorized" || role === "error") {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white font-sans">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-3xl font-black mb-2">Access Denied</h1>
        <p className="text-zinc-400 max-w-md text-center mb-8">
          You don't have permission to view this page, or your session has expired.
        </p>
        <button 
          onClick={() => window.location.href = "/"}
          className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-full font-bold transition-all"
        >
          Return Home
        </button>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white font-sans">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-zinc-500 text-sm tracking-widest uppercase">Authenticating...</p>
        </div>
      </div>
    );
  }

  const { totalPlays, totalUsers, botStats, commandUsage, statusActivity } = statsData;
  const servers = botStats?.servers || [];

  const StatCard = ({ title, value, icon, color }: any) => (
    <div className={`bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-5 relative overflow-hidden group`}>
      <div className={`absolute -right-4 -top-4 w-20 h-20 bg-${color}-500/10 rounded-full blur-xl group-hover:bg-${color}-500/20 transition-colors`}></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
          <h4 className="text-3xl font-black text-white">{value}</h4>
        </div>
        <div className={`text-${color}-400 text-xl bg-${color}-500/10 p-2.5 rounded-xl`}>{icon}</div>
      </div>
    </div>
  );

  const getStatusBadge = (s: string, title?: string) => {
    const isBug = title?.toLowerCase().includes("bug");
    switch(s) {
      case 'approved': 
        if (isBug) return <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-[10px] font-bold uppercase">Investigating</span>;
        return <span className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[10px] font-bold uppercase">Approved</span>;
      case 'denied': 
        if (isBug) return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[10px] font-bold uppercase">Not a Bug</span>;
        return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-[10px] font-bold uppercase">Denied</span>;
      case 'completed': 
        if (isBug) return <span className="px-2 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[10px] font-bold uppercase">Fixed</span>;
        return <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded text-[10px] font-bold uppercase">Released</span>;
      default: 
        return <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded text-[10px] font-bold uppercase">Pending</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col md:flex-row font-sans selection:bg-indigo-500/30 pt-16">
      {/* Sidebar Layout */}
      <aside className="w-full md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-white/10 bg-zinc-950/50 backdrop-blur-md z-10 hidden md:block relative">
        <div className="p-6 sticky top-16">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Command Center</h2>
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              Overview
            </button>
            {role === 'owner' && (
              <button onClick={() => setActiveTab('access')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'access' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                Access Control
              </button>
            )}
            {role === 'owner' && (
              <button onClick={() => setActiveTab('permissions')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'permissions' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Permissions
              </button>
            )}
            <button onClick={() => setActiveTab('suggestions')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'suggestions' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
              Feedback & Ideas
            </button>
            {(role === 'owner' || role === 'admin') && (
              <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                Users
              </button>
            )}
            {(role === 'owner' || role === 'admin') && (
              <button onClick={() => setActiveTab('system')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'system' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                System Tools
              </button>
            )}
            {(role === 'owner' || role === 'admin') && (
              <button onClick={() => setActiveTab('terminal')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'terminal' ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Server Terminal
              </button>
            )}
            {(role === 'owner' || role === 'admin') && (
              <button onClick={() => setActiveTab('chat-logs')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'chat-logs' ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                Chat Activity
              </button>
            )}
          </nav>
        </div>
      </aside>

      {/* Mobile Nav (Scrollable horizontal) */}
      <div className="md:hidden w-full overflow-x-auto flex gap-2 p-4 border-b border-white/10 bg-zinc-950/50 backdrop-blur-md sticky top-14 z-20 styled-scrollbar">
        <button onClick={() => setActiveTab('overview')} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ${activeTab === 'overview' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400'}`}>Overview</button>
        {role === 'owner' && <button onClick={() => setActiveTab('access')} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ${activeTab === 'access' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400'}`}>Access</button>}
        {role === 'owner' && <button onClick={() => setActiveTab('permissions')} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ${activeTab === 'permissions' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400'}`}>Permissions</button>}
        {(role === 'owner' || role === 'admin') && <button onClick={() => setActiveTab('users')} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ${activeTab === 'users' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400'}`}>Users</button>}
        <button onClick={() => setActiveTab('suggestions')} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ${activeTab === 'suggestions' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400'}`}>Feedback</button>
        {(role === 'owner' || role === 'admin') && <button onClick={() => setActiveTab('system')} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ${activeTab === 'system' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400'}`}>System Tools</button>}
        {(role === 'owner' || role === 'admin') && <button onClick={() => setActiveTab('terminal')} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ${activeTab === 'terminal' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-zinc-400'}`}>Terminal</button>}
        {(role === 'owner' || role === 'admin') && <button onClick={() => setActiveTab('chat-logs')} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold ${activeTab === 'chat-logs' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-zinc-400'}`}>Chat Logs</button>}
      </div>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">Admin Console</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Role: {role}</span>
            {statusActivity && (
              <span className="flex items-center gap-1.5 text-zinc-400 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Bot is listening to: <strong className="text-white">{statusActivity}</strong>
              </span>
            )}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Scrobbles" value={totalPlays.toLocaleString()} icon="🎵" color="indigo" />
              <StatCard title="Imported Users" value={totalUsers.toLocaleString()} icon="👥" color="purple" />
              <StatCard title="Active Guilds" value={botStats?.server_count || 0} icon="🖥️" color="emerald" />
              <StatCard title="Total Members" value={botStats?.member_count?.toLocaleString() || 0} icon="🌐" color="amber" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-lg">
                <div className="p-5 border-b border-white/5">
                  <h3 className="font-bold text-white text-lg">Command Usage</h3>
                </div>
                <div className="p-5 space-y-3">
                  {commandUsage.length > 0 ? commandUsage.map((cmd: any, i: number) => (
                    <div key={cmd.command_name} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                      <div className="flex items-center gap-3">
                        <span className="text-indigo-400 font-mono font-bold text-sm">/{cmd.command_name}</span>
                      </div>
                      <span className="text-zinc-400 text-sm">{cmd.usage_count.toLocaleString()} uses</span>
                    </div>
                  )) : <p className="text-zinc-500 text-sm italic">No data available.</p>}
                </div>
              </div>

              <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-lg">
                <div className="p-5 border-b border-white/5">
                  <h3 className="font-bold text-white text-lg">Top Guilds</h3>
                </div>
                <div className="divide-y divide-white/5">
                  {servers.slice(0, 5).map((server: any) => (
                    <div key={server.name} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {server.icon ? (
                          <img src={server.icon} className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold">{server.name.charAt(0)}</div>
                        )}
                        <span className="font-semibold text-zinc-200">{server.name}</span>
                      </div>
                      <span className="text-xs font-medium text-zinc-500">{server.member_count.toLocaleString()} members</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'access' && role === 'owner' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-white mb-1">Access Control</h2>
              <p className="text-zinc-400 text-sm mb-6">Manage who has access to the admin console and their permission level.</p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder="Discord User ID" 
                  value={newAdminId}
                  onChange={e => setNewAdminId(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <select 
                  value={newAdminRole}
                  onChange={e => setNewAdminRole(e.target.value)}
                  className="bg-zinc-950 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="admin">Full Admin</option>
                  <option value="moderator">Moderator</option>
                </select>
                <button 
                  onClick={addAdmin}
                  disabled={loadingAdmins || !newAdminId}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg transition-colors"
                >
                  {loadingAdmins ? "Adding..." : "Add User"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-lg">
                <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span> Full Admins
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-black/20 border border-white/5">
                    <span className="text-sm font-mono text-zinc-300">759433582107426816</span>
                    <span className="text-xs font-bold text-zinc-500 uppercase">Owner</span>
                  </div>
                  {adminUsers.admins.map((id: string) => (
                    <div key={id} className="flex justify-between items-center p-3 rounded-lg bg-black/20 border border-white/5">
                      <span className="text-sm font-mono text-zinc-300">{id}</span>
                      <button onClick={() => removeAdmin(id)} className="text-red-400 hover:text-red-300 text-xs font-bold uppercase transition-colors">Revoke</button>
                    </div>
                  ))}
                  {adminUsers.admins.length === 0 && <p className="text-zinc-500 text-sm italic">No additional admins assigned.</p>}
                </div>
              </div>

              <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-lg">
                <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> Moderators
                </h3>
                <div className="space-y-3">
                  {adminUsers.moderators.map((id: string) => (
                    <div key={id} className="flex justify-between items-center p-3 rounded-lg bg-black/20 border border-white/5">
                      <span className="text-sm font-mono text-zinc-300">{id}</span>
                      <button onClick={() => removeAdmin(id)} className="text-red-400 hover:text-red-300 text-xs font-bold uppercase transition-colors">Revoke</button>
                    </div>
                  ))}
                  {adminUsers.moderators.length === 0 && <p className="text-zinc-500 text-sm italic">No moderators assigned.</p>}
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'permissions' && role === 'owner' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-lg">
              <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Grant Command Permission
              </h3>
              <div className="flex flex-col md:flex-row gap-4">
                <select 
                  value={permUserId} 
                  onChange={(e) => setPermUserId(e.target.value)}
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all appearance-none"
                >
                  <option value="" disabled>Select User...</option>
                  {usersList.map((u: any) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.discord_username ? `@${u.discord_username}` : u.display_name || 'Unknown'} ({u.user_id})
                    </option>
                  ))}
                </select>

                <select 
                  value={permCommand} 
                  onChange={(e) => setPermCommand(e.target.value)}
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all appearance-none"
                >
                  <option value="" disabled>Select Command...</option>
                  <option value="restart">restart</option>
                  <option value="sync">sync</option>
                  <option value="stats">stats</option>
                  <option value="cleanduplicates">cleanduplicates</option>
                  <option value="testautorestart">testautorestart</option>
                  <option value="wipedata">wipedata</option>
                  <option value="resetcd">resetcd</option>
                </select>
                <button 
                  onClick={handleGrantPermission}
                  className="bg-indigo-500 hover:bg-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] text-white px-8 py-2.5 rounded-lg font-bold transition-all whitespace-nowrap"
                >
                  Grant Access
                </button>
              </div>
            </div>

            <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-lg">
              <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-white font-bold text-lg">Active Permissions</h3>
                <p className="text-sm text-zinc-400 mt-1">Manage which users have access to specific restricted commands.</p>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-black/20">
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">User ID</th>
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Command</th>
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loadingPerms ? (
                    <tr><td colSpan={3} className="p-8 text-center text-zinc-500">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-indigo-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                        Loading permissions...
                      </div>
                    </td></tr>
                  ) : permissionsList.length === 0 ? (
                    <tr><td colSpan={3} className="p-12 text-center text-zinc-500">
                      <svg className="w-12 h-12 mx-auto mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      No command permissions granted yet.
                    </td></tr>
                  ) : (
                    permissionsList.map((perm, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="p-4 font-mono text-sm text-zinc-300">{perm.user_id}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center rounded-md bg-indigo-500/10 px-2.5 py-1 text-sm font-medium text-indigo-400 border border-indigo-500/20">
                            .{perm.command_name}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleRevokePermission(perm.user_id, perm.command_name)}
                            className="opacity-0 group-hover:opacity-100 px-4 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-sm font-bold transition-all shadow-[0_0_10px_rgba(239,68,68,0)] hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (role === 'owner' || role === 'admin') && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-lg">
              <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">User Management</h2>
                  <p className="text-zinc-400 text-sm mt-1">View users, moderate accounts, and enforce bans.</p>
                </div>
              </div>
              <div className="divide-y divide-white/5 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-black/20">
                      <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Discord User</th>
                      <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Display Name</th>
                      <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Last.fm Username</th>
                      <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-center">Status</th>
                      <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loadingUsers ? (
                      <tr><td colSpan={5} className="p-8 text-center text-zinc-500">Loading users...</td></tr>
                    ) : usersList.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No users found.</td></tr>
                    ) : (
                      usersList.map((u) => (
                        <tr key={u.user_id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4">
                            <div className="font-mono text-sm text-zinc-300">{u.discord_username || "Unknown"}</div>
                            <div className="text-xs text-zinc-600">{u.user_id}</div>
                          </td>
                          <td className="p-4">
                            <span className="text-sm font-medium text-white">{u.display_name || "-"}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-zinc-400">{u.lastfm_username || "-"}</span>
                          </td>
                          <td className="p-4 text-center">
                            {u.is_banned ? (
                              <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold uppercase" title={u.ban_reason}>Banned</span>
                            ) : (
                              <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold uppercase">Active</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-2">
                              {u.is_banned ? (
                                <button onClick={() => handleUserAction(u.user_id, 'UNBAN')} className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors">Unban</button>
                              ) : (
                                <button onClick={() => {
                                  const reason = prompt("Enter ban reason:");
                                  if (reason !== null) handleUserAction(u.user_id, 'BAN', { reason });
                                }} className="px-3 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-colors">Ban</button>
                              )}
                              <button onClick={() => {
                                const name = prompt("Enter new display name (leave empty to clear):", u.display_name || "");
                                if (name !== null) handleUserAction(u.user_id, 'EDIT_NAME', { displayName: name || null });
                              }} className="px-3 py-1.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-bold transition-colors">Edit Name</button>
                              <button onClick={() => {
                                if (confirm("Are you sure you want to reset this user's profile?")) handleUserAction(u.user_id, 'RESET');
                              }} className="px-3 py-1.5 rounded bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold transition-colors">Reset</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'suggestions' && (
          <div className="space-y-6 animate-fade-in-up">
            <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-lg">
              <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Manage Feedback</h2>
                  <p className="text-zinc-400 text-sm mt-1">Review user suggestions and post public updates.</p>
                </div>
              </div>
              <div className="divide-y divide-white/5">
                {suggestions.length === 0 ? (
                  <div className="p-12 text-center text-zinc-500">No suggestions yet.</div>
                ) : (
                  suggestions.map((s) => (
                    <div key={s.id} className="p-6">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-lg font-bold text-white">{s.title}</span>
                            {getStatusBadge(s.status, s.title)}
                          </div>
                          <div className="text-xs text-zinc-500">From <span className="text-indigo-400">{s.username}</span> • {new Date(s.created_at).toLocaleDateString()}</div>
                        </div>
                        {editingSuggestion !== s.id && (
                          <button onClick={() => { setEditingSuggestion(s.id); setEditStatus(s.status); setEditFeedback(s.admin_feedback || ""); }} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-xs font-bold transition-colors">
                            Review
                          </button>
                        )}
                      </div>
                      
                      <div className="bg-black/20 border border-white/5 p-4 rounded-xl text-zinc-300 text-sm mb-4">
                        {s.description}
                      </div>

                      {s.admin_feedback && editingSuggestion !== s.id && (
                        <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl">
                          <h5 className="text-indigo-400 text-[10px] font-bold uppercase tracking-wider mb-1">Admin Reply</h5>
                          <p className="text-indigo-100 text-sm">{s.admin_feedback}</p>
                        </div>
                      )}

                      {editingSuggestion === s.id && (
                        <div className="bg-zinc-950 border border-indigo-500/30 p-5 rounded-xl mt-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Status</label>
                              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                                <option value="pending">Pending</option>
                                {s.title?.toLowerCase().includes("bug") ? (
                                  <>
                                    <option value="approved">Investigating</option>
                                    <option value="denied">Not a Bug</option>
                                    <option value="completed">Fixed</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="approved">Approved</option>
                                    <option value="denied">Denied</option>
                                    <option value="completed">Update Released</option>
                                  </>
                                )}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Public Reply</label>
                              <input type="text" value={editFeedback} onChange={(e) => setEditFeedback(e.target.value)} placeholder="Will be visible to all users..." className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                            </div>
                          </div>
                          <div className="mt-4 flex justify-end gap-2">
                            <button onClick={() => setEditingSuggestion(null)} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white">Cancel</button>
                            <button onClick={() => saveSuggestionUpdate(s.id)} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-colors">Save Update</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'system' && (role === 'owner' || role === 'admin') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up">
            <div className="space-y-6">
              <PushGlobalUpdateCard />
            </div>
            <div className="space-y-6">
              <AdminActionCard 
                title="Sync Slash Commands"
                description="Force an update of Discord global slash commands."
                actionType="SYNC_COMMANDS"
                colorClass="indigo"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
              />
              <AdminActionCard 
                title="Restart Bot Instance"
                description="Send a signal to reboot the bot safely."
                actionType="RESTART_BOT"
                colorClass="red"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
              <AdminActionCard 
                title="Renew Host Server"
                description="Add 24 hours to your free bot hosting."
                actionType="RENEW_HOST_SERVER"
                colorClass="pink"
                icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
            </div>
          </div>
        )}

        {activeTab === 'terminal' && (role === 'owner' || role === 'admin') && (
          <AdminTerminal />
        )}

        {activeTab === 'chat-logs' && (role === 'owner' || role === 'admin') && (
          <AdminChatLogs />
        )}
      </main>
    </div>
  );
}
