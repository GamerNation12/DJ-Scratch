"use client";

import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

const INVITE_LINK = "https://discord.com/oauth2/authorize?client_id=1509709265659760741&permissions=8&scope=bot%20applications.commands";

export default function Home() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<{ totalUsers: number, activeMembers: number, topAvatars?: string[] }>({ totalUsers: 0, activeMembers: 0, topAvatars: [] });

  useEffect(() => {
    setMounted(true);
    fetch("/api/public/stats")
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);
  }, []);

  if (!mounted || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Fallback avatars if not enough top users
  const defaultAvatars = [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Annie&backgroundColor=c0aede",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Bandit&backgroundColor=ffdfbf"
  ];
  const displayAvatars = (stats.topAvatars && stats.topAvatars.length > 0) 
    ? [...stats.topAvatars, ...defaultAvatars].slice(0, 3) 
    : defaultAvatars;

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-indigo-500/30 overflow-hidden relative flex flex-col items-center">
      {/* Premium Animated Mesh Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 flex justify-center items-center opacity-50">
        <div className="absolute w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-blob"></div>
        <div className="absolute w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] mix-blend-screen animate-blob animation-delay-200"></div>
        <div className="absolute w-[700px] h-[700px] bg-purple-600/10 rounded-full blur-[120px] mix-blend-screen animate-blob animation-delay-400"></div>
      </div>
      
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none z-0 mix-blend-overlay"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0"></div>
      
      <main className="relative z-10 w-full flex-grow flex flex-col items-center">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-32 pb-24 text-center flex flex-col items-center min-h-[85vh] justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-zinc-300 text-xs font-semibold mb-8 backdrop-blur-md animate-fade-in-up uppercase tracking-widest hover:bg-white/10 transition-colors">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            The Ultimate Music Bot
          </div>
          <h1 className="text-6xl sm:text-7xl md:text-9xl font-black tracking-tighter mb-6 leading-[0.95] max-w-5xl mx-auto animate-fade-in-up animation-delay-100">
            Elevate Your <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 via-purple-400 to-emerald-400 drop-shadow-sm">
              Server's Vibe.
            </span>
          </h1>
          <p className="text-lg md:text-2xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed font-medium tracking-tight animate-fade-in-up animation-delay-200">
            Seamless Last.fm integration, gorgeous embed layouts, and deeply personalized music statistics for your Discord community.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 animate-fade-in-up animation-delay-300">
            <a 
              href={INVITE_LINK}
              target="_blank"
              rel="noreferrer"
              className="px-8 py-4 bg-white text-zinc-950 font-bold rounded-xl text-sm md:text-base hover:scale-105 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.2)] flex items-center gap-2"
            >
              <span>Add to Discord</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </a>
            {session ? (
              <Link 
                href="/dashboard"
                className="px-8 py-4 bg-zinc-900/80 backdrop-blur-md border border-white/10 hover:bg-zinc-800 text-white font-semibold rounded-xl text-sm md:text-base transition-all duration-300 flex items-center gap-2"
              >
                Go to Dashboard
              </Link>
            ) : (
              <button 
                onClick={() => signIn("discord")}
                className="px-8 py-4 bg-zinc-900/80 backdrop-blur-md border border-white/10 hover:bg-zinc-800 text-white font-semibold rounded-xl text-sm md:text-base transition-all duration-300 flex items-center gap-2"
              >
                Login to Dashboard
              </button>
            )}
          </div>
          
          <div className="mt-12 flex flex-col items-center gap-3 animate-fade-in-up animation-delay-400">
            <div className="flex -space-x-3">
              {displayAvatars.map((src, i) => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-[#09090b] bg-zinc-800 overflow-hidden shadow-lg flex items-center justify-center">
                  <img src={src} alt="Top User" className="w-full h-full object-cover" />
                </div>
              ))}
              <div className="w-10 h-10 rounded-full border-2 border-[#09090b] bg-zinc-800 flex items-center justify-center text-[11px] font-bold text-white shadow-lg shadow-indigo-500/10 backdrop-blur-md">
                +{stats.totalUsers ? (stats.totalUsers > 3 ? stats.totalUsers - 3 : 0) : '...'}
              </div>
            </div>
            <p className="text-sm text-zinc-400 font-medium text-center">
              Join <span className="text-white font-bold">{stats.totalUsers ? stats.totalUsers.toLocaleString() : '...'} registered users</span> across <br className="sm:hidden" /><span className="text-white font-bold">{stats.activeMembers ? stats.activeMembers.toLocaleString() : '...'} Discord members</span> using the bot right now.
            </p>
          </div>
        </section>

        {/* Bento Grid Features Section */}
        <section id="features" className="container mx-auto px-4 py-32 w-full max-w-7xl">
          <div className="mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">Powering your music <br className="hidden sm:block" /> experience.</h2>
            <p className="text-zinc-500 text-lg font-medium max-w-xl">A complete suite of tools designed to make sharing and discovering music effortless and beautiful.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:auto-rows-[300px]">
            {/* Feature 1: Large Span */}
            <div className="md:col-span-2 group relative overflow-hidden bg-zinc-950/50 border border-white/10 p-8 rounded-3xl hover:border-indigo-500/30 transition-colors flex flex-col justify-end">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none"></div>
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] group-hover:bg-indigo-500/30 transition-colors"></div>
              
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-2xl mb-6">🎵</div>
                <h3 className="text-2xl font-bold mb-2 text-white">Deep Last.fm Integration</h3>
                <p className="text-zinc-400 font-medium leading-relaxed max-w-md">Connect your account once and instantly share real-time plays, recent scrobbles, and deep listening statistics directly in Discord.</p>
              </div>
            </div>

            {/* Feature 2: Small */}
            <div className="md:col-span-1 group relative overflow-hidden bg-zinc-950/50 border border-white/10 p-8 rounded-3xl hover:border-purple-500/30 transition-colors flex flex-col justify-end">
              <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-purple-500/20 rounded-full blur-[60px] group-hover:bg-purple-500/30 transition-colors"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-2xl mb-6">🎨</div>
                <h3 className="text-xl font-bold mb-2 text-white">Custom Layouts</h3>
                <p className="text-zinc-400 text-sm font-medium leading-relaxed">Choose from minimal text to rich, full-sized image embeds for your `/fm` command.</p>
              </div>
            </div>

            {/* Feature 3: Small */}
            <div className="md:col-span-1 group relative overflow-hidden bg-zinc-950/50 border border-white/10 p-8 rounded-3xl hover:border-emerald-500/30 transition-colors flex flex-col justify-end">
              <div className="absolute -top-12 -left-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-[60px] group-hover:bg-emerald-500/20 transition-colors"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-2xl mb-6">🤖</div>
                <h3 className="text-xl font-bold mb-2 text-white">Dynamic Bot Avatar</h3>
                <p className="text-zinc-400 text-sm font-medium leading-relaxed">The bot dynamically updates its avatar to match the album cover of your currently playing track.</p>
              </div>
            </div>

            {/* Feature 4: Large Span */}
            <div className="md:col-span-2 group relative overflow-hidden bg-zinc-950/50 border border-white/10 p-8 rounded-3xl hover:border-zinc-500/30 transition-colors flex flex-col justify-end">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-t from-zinc-800/10 to-transparent pointer-events-none"></div>
              
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-2xl mb-6">⚡</div>
                <h3 className="text-2xl font-bold mb-2 text-white">Lightning Fast & Reliable</h3>
                <p className="text-zinc-400 font-medium leading-relaxed max-w-md">Built on a highly optimized Python backend and Postgres DB, ensuring your music commands execute instantly with zero latency.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
