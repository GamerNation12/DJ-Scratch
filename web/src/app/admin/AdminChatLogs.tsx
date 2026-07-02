"use client";
import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/fetchApi";

export default function AdminChatLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      try {
        const res = await fetchApi("/api/admin/chat-logs");
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      } catch (e) {
        console.error("Failed to load chat logs");
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              Chat Activity Log
            </h2>
            <p className="text-zinc-400 text-sm mt-1">
              Privacy-safe log of who is sending messages. <strong className="text-emerald-400">Message content is end-to-end encrypted and never logged here.</strong>
            </p>
          </div>
        </div>
        <div className="divide-y divide-white/5 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-black/20">
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Time</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Sender</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-center">Direction</th>
                <th className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Receiver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-zinc-500">Loading chat activity...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-zinc-500">No chat activity found.</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="text-xs text-zinc-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {log.sender_avatar ? (
                          <img src={log.sender_avatar} className="w-8 h-8 rounded-full bg-zinc-800" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                            {(log.sender_username || "?")[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-sm text-zinc-200">{log.sender_username || "Unknown"}</div>
                          <div className="text-xs font-mono text-zinc-600">{log.sender_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center">
                        <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {log.receiver_avatar ? (
                          <img src={log.receiver_avatar} className="w-8 h-8 rounded-full bg-zinc-800" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-xs">
                            {(log.receiver_username || "?")[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-sm text-zinc-200">{log.receiver_username || "Unknown"}</div>
                          <div className="text-xs font-mono text-zinc-600">{log.receiver_id}</div>
                        </div>
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
  );
}
