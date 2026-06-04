"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

function AdminActionCard({ title, description, actionType, icon, colorClass }: any) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleAction = async () => {
    setLoading(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/admin/action", {
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

  return (
    <div className={`bg-gray-900/40 border border-gray-800 rounded-2xl p-6 hover:border-${colorClass}-500/50 transition-all group flex flex-col justify-between`}>
      <div>
        <div className={`w-12 h-12 rounded-xl bg-${colorClass}-500/10 text-${colorClass}-400 flex items-center justify-center mb-4`}>
          {icon}
        </div>
        <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
        <p className="text-gray-400 text-sm mb-6">{description}</p>
      </div>
      <button
        onClick={handleAction}
        disabled={loading}
        className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2
          ${status === "success" ? "bg-green-500 text-white" : 
            status === "error" ? "bg-red-500 text-white" : 
            `bg-${colorClass}-500 hover:bg-${colorClass}-600 text-white shadow-lg shadow-${colorClass}-500/20`}`}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing
          </span>
        ) : status === "success" ? "Done!" : status === "error" ? "Failed" : "Execute Action"}
      </button>
    </div>
  );
}

export default function AdminClient({ data }: { data: any }) {
  const { data: session } = useSession();
  
  if (!session || (session.user as any)?.id !== "759433582107426816") {
    return null;
  }

  const { totalPlays, totalUsers, botStats, commandUsage } = data;
  const servers = botStats?.servers || [];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 font-sans mt-4">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="mb-12">
          <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 bg-clip-text text-transparent inline-block pb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-400 mt-2 text-lg">System control and analytics hub.</p>
        </header>

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-gray-500 font-semibold mb-2">Total Scrobbles</h3>
            <p className="text-4xl font-black text-white">{totalPlays.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-gray-500 font-semibold mb-2">Imported Users</h3>
            <p className="text-4xl font-black text-white">{totalUsers.toLocaleString()}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-gray-500 font-semibold mb-2">Active Servers</h3>
            <p className="text-4xl font-black text-white">{botStats?.server_count || 0}</p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-gray-500 font-semibold mb-2">Total Members</h3>
            <p className="text-4xl font-black text-white">{botStats?.member_count?.toLocaleString() || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-1 space-y-6">
            <h2 className="text-2xl font-bold text-white mb-6">Quick Actions</h2>
            
            <AdminActionCard 
              title="Sync Commands"
              description="Sync slash commands globally."
              actionType="SYNC_COMMANDS"
              colorClass="indigo"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            />

            <AdminActionCard 
              title="Restart Bot"
              description="Reboots the python process safely."
              actionType="RESTART_BOT"
              colorClass="red"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />

            <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 hover:border-emerald-500/50 transition-all group flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-lg mb-1">Assume Bot Identity</h3>
                <p className="text-gray-400 text-sm mb-6">Disguise yourself as The Goats DJ.</p>
              </div>
              <button
                onClick={() => {
                  const current = localStorage.getItem("botMode") === "true";
                  localStorage.setItem("botMode", current ? "false" : "true");
                  window.dispatchEvent(new Event("botModeToggled"));
                }}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
              >
                Toggle Identity
              </button>
            </div>
          </div>

          {/* Tables */}
          <div className="lg:col-span-2 space-y-8">
            {/* Top Commands */}
            <div className="bg-gray-900/30 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-800 bg-gray-900/50">
                <h2 className="text-xl font-bold text-white">Most Used Commands</h2>
              </div>
              <div className="p-6">
                {commandUsage.length > 0 ? (
                  <div className="space-y-4">
                    {commandUsage.map((cmd: any, i: number) => (
                      <div key={cmd.command_name} className="flex items-center justify-between p-4 rounded-xl bg-gray-900/80 border border-gray-800/50">
                        <div className="flex items-center gap-4">
                          <span className="text-gray-500 font-mono text-sm">#{i + 1}</span>
                          <span className="text-indigo-400 font-mono font-medium">/{cmd.command_name}</span>
                        </div>
                        <span className="text-gray-300 font-semibold">{cmd.usage_count.toLocaleString()} uses</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No commands tracked yet. Use the bot to see stats.</p>
                )}
              </div>
            </div>

            {/* Server List */}
            <div className="bg-gray-900/30 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Connected Servers</h2>
                <span className="px-3 py-1 bg-gray-800 rounded-full text-xs font-semibold text-gray-400">
                  Top 10 Largest
                </span>
              </div>
              <div className="divide-y divide-gray-800/50">
                {servers.slice(0, 10).map((server: any) => (
                  <div key={server.name} className="p-4 hover:bg-gray-800/30 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {server.icon ? (
                        <img src={server.icon} alt={server.name} className="w-10 h-10 rounded-full border border-gray-700" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 font-bold">
                          {server.name.charAt(0)}
                        </div>
                      )}
                      <span className="font-semibold text-gray-200">{server.name}</span>
                    </div>
                    <span className="text-sm text-gray-400 bg-gray-800/50 px-3 py-1 rounded-full">
                      {server.member_count.toLocaleString()} members
                    </span>
                  </div>
                ))}
                {servers.length === 0 && (
                  <div className="p-6 text-gray-500 italic">No servers found or bot stats not pushed yet.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
