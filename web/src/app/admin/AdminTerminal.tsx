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
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://mango.fps.ms:20544";
        const { io } = await import("socket.io-client");
        
        if (!active) return;

        const socket = io(socketUrl, {
          transports: ["websocket", "polling"],
          reconnection: true
        });

        socket.on("connect", () => {
          setStatus("connected");
          socket.emit("admin_auth", "dashboard-admin");
        });

        socket.on("terminal_log", (data) => {
          if (data && data.log) {
            const text = data.log.replace(/\x1b\[[0-9;]*m/g, "");
            setLogs((prev) => [...prev, text].slice(-500));
          }
        });

        socket.on("connect_error", () => setStatus("error"));
        socket.on("disconnect", () => setStatus("disconnected"));

        // @ts-ignore
        wsRef.current = { close: () => socket.disconnect() };
      } catch (err) {
        if (active) setStatus("error");
      }
    }

    initTerminal();

    return () => {
      active = false;
      if (wsRef.current) (wsRef.current as any).close();
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
