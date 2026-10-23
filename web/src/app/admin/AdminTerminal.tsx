"use client";

import { useEffect, useRef, useState } from "react";
import { fetchApi } from "@/lib/fetchApi";

type TerminalStatus = "connecting" | "connected" | "error" | "disconnected";

export default function AdminTerminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<TerminalStatus>("connecting");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;

    async function initTerminal() {
      setStatus("connecting");
      setError("");

      try {
        // The Pterodactyl websocket token is fetched server-side and only
        // returned to an authenticated owner/admin. Never put a shared
        // console password in client-side code.
        const res = await fetchApi("/api/admin/terminal");
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "Could not authenticate with the server");
        }
        if (!data?.token || !data?.socket) {
          throw new Error("The server did not return a terminal session");
        }
        if (!active) return;

        ws = new WebSocket(data.socket);
        wsRef.current = ws;

        ws.onopen = () => {
          ws?.send(JSON.stringify({ event: "auth", args: [data.token] }));
        };

        ws.onmessage = (event) => {
          let message: { event?: string; args?: unknown[] };
          try {
            message = JSON.parse(String(event.data));
          } catch {
            return;
          }

          if (message.event === "auth success") {
            setStatus("connected");
            // Subscribe to the live console stream.
            ws?.send(JSON.stringify({ event: "send logs", args: [null] }));
            return;
          }

          if (message.event === "console output") {
            const line = Array.isArray(message.args) ? message.args[0] : "";
            if (typeof line !== "string") return;
            const clean = line.replace(/\x1b\[[0-9;]*m/g, "");
            setLogs((previous) => [...previous, clean].slice(-500));
          }
        };

        ws.onerror = () => {
          if (!active) return;
          setStatus("error");
          setError("The server terminal connection failed.");
        };

        ws.onclose = () => {
          if (!active) return;
          setStatus((current) => (current === "error" ? "error" : "disconnected"));
        };
      } catch (err) {
        if (!active) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not connect to the terminal");
      }
    }

    initTerminal();

    return () => {
      active = false;
      ws?.close();
      wsRef.current = null;
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
          {status === "connected" && <span className="text-emerald-400 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Connected</span>}
          {status === "connecting" && <span className="text-yellow-400">Connecting...</span>}
          {status === "disconnected" && <span className="text-zinc-500">Disconnected</span>}
          {status === "error" && <span className="text-red-400">Connection Error</span>}
        </div>
      </div>
      <div
        ref={terminalRef}
        className="flex-1 bg-black rounded-b-2xl p-4 font-mono text-sm text-zinc-300 overflow-y-auto border border-t-0 border-white/5 styled-scrollbar"
      >
        {logs.length === 0 && status === "connected" && <div className="text-zinc-600 italic">Waiting for logs...</div>}
        {logs.length === 0 && status === "connecting" && <div className="text-zinc-600 italic">Opening an authenticated console session...</div>}
        {logs.length === 0 && status === "error" && (
          <div className="text-red-400/90">
            {error || "Could not open the server console."}
          </div>
        )}
        {logs.length === 0 && status === "disconnected" && (
          <div className="text-zinc-600 italic">The console connection closed.</div>
        )}
        {logs.map((log, index) => (
          <div key={index} className="whitespace-pre-wrap break-all py-0.5">{log}</div>
        ))}
      </div>
    </div>
  );
}
