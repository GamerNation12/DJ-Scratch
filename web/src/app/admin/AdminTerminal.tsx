"use client";
import { useEffect, useRef, useState } from "react";
import { fetchApi } from "@/lib/fetchApi";

export default function AdminTerminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "error" | "disconnected">("connecting");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let active = true;

    async function initTerminal() {
      try {
        const res = await fetchApi("/api/admin/terminal");
        if (!res.ok) throw new Error("Failed to fetch terminal token");
        const data = await res.json();
        
        if (!active) return;

        const ws = new WebSocket(data.socket);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ event: "auth", args: [data.token] }));
          setStatus("connected");
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === "console output") {
              // msg.args contains the log line, which might have ansi color codes
              // We'll strip basic ansi codes for now, or just render it raw
              const rawText = msg.args.join(" ");
              // Simple ansi strip regex
              const text = rawText.replace(/\x1b\[[0-9;]*m/g, "");
              setLogs((prev) => [...prev, text].slice(-500)); // keep last 500 lines
            }
          } catch (e) {}
        };

        ws.onerror = () => setStatus("error");
        ws.onclose = () => setStatus("disconnected");
      } catch (err) {
        if (active) setStatus("error");
      }
    }

    initTerminal();

    return () => {
      active = false;
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="space-y-4 animate-fade-in-up h-[70vh] flex flex-col">
      <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-t-2xl p-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <h2 className="text-lg font-bold text-white">Live Server Terminal</h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          {status === 'connected' && <span className="text-emerald-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Connected</span>}
          {status === 'connecting' && <span className="text-yellow-400">Connecting...</span>}
          {status === 'disconnected' && <span className="text-zinc-500">Disconnected</span>}
          {status === 'error' && <span className="text-red-400">Connection Error</span>}
        </div>
      </div>
      <div 
        ref={terminalRef}
        className="flex-1 bg-black rounded-b-2xl p-4 font-mono text-sm text-zinc-300 overflow-y-auto border border-t-0 border-white/5 styled-scrollbar"
      >
        {logs.length === 0 && status === 'connected' && <div className="text-zinc-600 italic">Waiting for logs...</div>}
        {logs.map((log, i) => (
          <div key={i} className="whitespace-pre-wrap break-all py-0.5">{log}</div>
        ))}
      </div>
    </div>
  );
}
