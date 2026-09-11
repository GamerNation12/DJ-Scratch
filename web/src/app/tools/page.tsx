"use client";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Crown, Gauge, HeartHandshake, Wrench } from "lucide-react";

const TOOLS = [
  {
    href: "/tools/whoknows",
    icon: <Crown className="w-7 h-7 text-amber-300" />,
    glow: "group-hover:border-amber-500/30",
    title: "WhoKnows Lookup",
    desc: "Who across the whole bot listens to an artist, track or album most. No Discord needed.",
    bot: "Bot: /globalwhoknows",
  },
  {
    href: "/tools/pace",
    icon: <Gauge className="w-7 h-7 text-emerald-300" />,
    glow: "group-hover:border-emerald-500/30",
    title: "Pace & Milestones",
    desc: "Total plays, daily rate, next milestone and ETA for any Last.fm username.",
    bot: "Bot: /pace · /milestone",
  },
  {
    href: "/tools/taste",
    icon: <HeartHandshake className="w-7 h-7 text-pink-300" />,
    glow: "group-hover:border-pink-500/30",
    title: "Taste Compare",
    desc: "Compatibility score between any two Last.fm users, with shared artists.",
    bot: "Bot: /taste",
  },
];

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden relative pb-32">
      <Navbar />
      <div className="fixed top-0 left-1/4 w-1/2 h-[500px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none z-0" />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 relative z-10 max-w-4xl animate-fade-in-up">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 mb-4 flex items-center justify-center gap-4">
            <Wrench className="w-10 h-10 md:w-14 md:h-14 text-indigo-400" />
            Tools
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl">
            Bot commands, in your browser. Works for any Last.fm username.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`group bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:border-indigo-500/30 ${t.glow} transition-all duration-300 shadow-lg flex flex-col`}
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                {t.icon}
              </div>
              <h2 className="text-white font-bold text-lg mb-1">{t.title}</h2>
              <p className="text-zinc-400 text-sm leading-relaxed flex-1">{t.desc}</p>
              <p className="text-zinc-600 text-xs font-mono mt-4">{t.bot}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
