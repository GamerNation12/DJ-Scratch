"use client";

import { useEffect, useState } from "react";

type SupportData = {
  name: string;
  icon: string | null;
  memberCount: number | null;
  onlineCount: number | null;
  members: { id: string; name: string; avatar: string | null }[];
  invite: string;
  ownerOnline?: boolean;
};

export default function SupportWidget() {
  const [data, setData] = useState<SupportData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/support");
        if (!res.ok) throw new Error(`support ${res.status}`);
        const json = await res.json();
        if (!cancelled && !json.error) setData(json);
        else if (!cancelled) setFailed(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Static fallback so the section never sits empty (route still deploying
  // or Discord hiccup) — Join button always works.
  const view = data ?? (failed
    ? {
        name: "DJ Scratch Support",
        icon: null,
        memberCount: null,
        onlineCount: null,
        members: [],
        invite: "https://discord.gg/53sxaVWn92",
      }
    : null);
  if (!view) return null;

  return (
    <div className="relative overflow-hidden bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-3xl md:rounded-[2rem] p-6 md:p-10 max-w-3xl w-full hover:border-indigo-500/40 transition-all duration-500">
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
        {view.icon ? (
          <img
            src={view.icon}
            alt="Server icon"
            className="w-20 h-20 rounded-2xl shadow-lg shrink-0"
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-3xl shrink-0">
            🎧
          </div>
        )}
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-2xl font-bold text-white tracking-tight">{view.name}</h3>
          <div className="flex items-center justify-center sm:justify-start gap-4 mt-1 text-sm text-zinc-400 font-medium">
            {view.onlineCount !== null && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                {view.onlineCount} online
              </span>
            )}
            {view.memberCount !== null && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
                {view.memberCount} members
              </span>
            )}
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-2 text-sm font-medium">
            <span className={`w-2 h-2 rounded-full ${view.ownerOnline ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`}></span>
            <span className={view.ownerOnline ? "text-emerald-300" : "text-zinc-500"}>
              Owner {view.ownerOnline ? "online" : "offline"}
            </span>
          </div>
          {view.members.length > 0 && (
            <div className="flex -space-x-2 mt-3 justify-center sm:justify-start">
              {view.members.slice(0, 10).map((m) => (
                <div
                  key={m.id}
                  title={m.name}
                  className="w-8 h-8 rounded-full border-2 border-zinc-900 bg-zinc-800 overflow-hidden"
                >
                  {m.avatar ? (
                    <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <a
          href={view.invite}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-xl text-sm transition-all duration-300 shadow-lg shadow-[#5865F2]/20"
        >
          Join Server
        </a>
      </div>
    </div>
  );
}
