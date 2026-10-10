"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Pick = { title: string; subtitle: string; posted_at: string | null };

const CARDS = [
  { kind: "songs", emoji: "🎲", label: "Song of the Day" },
  { kind: "users", emoji: "🌟", label: "Member Spotlight" },
  { kind: "albums", emoji: "💿", label: "Album of the Day" },
] as const;

export default function CommunityPage() {
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/spotlight")
      .then((r) => r.json())
      .then((d) => {
        if (d?.picks) setPicks(d.picks);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0e0618] text-white font-sans flex flex-col items-center">
      <main className="w-full max-w-5xl mx-auto px-4 pt-24 pb-24">
        <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-12 font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg> Back to Home
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-display font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">
            Community Picks
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto font-medium">
            Every day the community spotlights a song, a member, and an album from the support server&apos;s listening.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
            <div className="text-zinc-500 font-medium animate-pulse">Loading today&apos;s picks...</div>
          </div>
        ) : CARDS.every((c) => !picks[c.kind]?.title) ? (
          <div className="bg-[#170b28]/50 backdrop-blur-xl border border-white/10 p-12 rounded-3xl text-center max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold mb-3">No picks yet today</h3>
            <p className="text-zinc-400">Check back after the next daily drop — or join the support server to see them live.</p>
            <a
              href="https://discord.gg/MT6d7jh3rv"
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-6 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold transition-colors"
            >
              Join the support server
            </a>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-5">
            {CARDS.map((c) => {
              const p = picks[c.kind];
              if (!p?.title) return null;
              return (
                <div key={c.kind} className="bg-[#170b28]/40 backdrop-blur-md border border-white/10 rounded-3xl p-6">
                  <div className="text-3xl mb-3">{c.emoji}</div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-1">{c.label}</div>
                  <div className="text-xl font-bold text-white leading-snug">{p.title}</div>
                  <div className="text-sm text-zinc-400 mt-1">{p.subtitle}</div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-zinc-600 text-sm mt-10">
          Want these in your own server? An admin can run <span className="font-mono text-zinc-400">/spotlight</span> to set it up.
        </p>
      </main>
    </div>
  );
}
