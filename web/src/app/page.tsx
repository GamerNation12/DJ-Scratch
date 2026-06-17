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

  const displayAvatars = stats.topAvatars || [];

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-indigo-500/30 overflow-hidden relative flex flex-col items-center">
      {/* Premium Animated Mesh Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 flex justify-center items-center opacity-50">
        <div className="absolute w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-blob"></div>
        <div className="absolute w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] mix-blend-screen animate-blob animation-delay-200"></div>
        <div className="absolute w-[700px] h-[700px] bg-purple-600/10 rounded-full blur-[120px] mix-blend-screen animate-blob animation-delay-400"></div>
      </div>
      
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] pointer-events-none z-0 mix-blend-overlay"></div>
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
                onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
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
                +{stats.totalUsers ? (stats.totalUsers > displayAvatars.length ? stats.totalUsers - displayAvatars.length : 0) : '...'}
              </div>
            </div>
            <p className="text-sm text-zinc-400 font-medium text-center">
              Join <span className="text-white font-bold">{stats.totalUsers ? stats.totalUsers.toLocaleString() : '...'} registered users</span> across <br className="sm:hidden" /><span className="text-white font-bold">{stats.activeMembers ? stats.activeMembers.toLocaleString() : '...'} Discord members</span> using the bot right now.
            </p>
          </div>
        </section>

        {/* Premium Bento Grid Features Section */}
        <section id="features" className="container mx-auto px-4 py-32 w-full max-w-7xl relative z-10">
          <div className="mb-20 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-300 text-xs font-semibold mb-6 uppercase tracking-widest">
                Features
              </div>
              <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-500">
                Powering your <br className="hidden sm:block" /> music experience.
              </h2>
            </div>
            <p className="text-zinc-400 text-lg md:text-xl font-medium max-w-lg leading-relaxed">
              A complete suite of tools designed to make sharing and discovering music effortless, interactive, and beautiful.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:auto-rows-[340px]">
            {/* Feature 1: Large Span - Deep Last.fm */}
            <div className="md:col-span-2 group relative overflow-hidden bg-zinc-900/40 backdrop-blur-md border border-white/10 p-10 rounded-[2rem] hover:border-indigo-500/40 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/20 flex flex-col justify-between">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent pointer-events-none"></div>
              <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] group-hover:bg-indigo-500/30 transition-colors duration-700"></div>
              
              <div className="absolute top-10 right-10 opacity-20 group-hover:opacity-100 transition-opacity duration-500 hidden sm:block">
                <div className="bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 w-64 shadow-2xl transform rotate-3 group-hover:rotate-6 transition-transform duration-500">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-500 to-orange-500 animate-pulse"></div>
                    <div>
                      <div className="h-3 w-24 bg-white/20 rounded-full mb-1"></div>
                      <div className="h-2 w-16 bg-white/10 rounded-full"></div>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-2/3"></div>
                  </div>
                </div>
              </div>
              
              <div className="relative z-10 mt-auto">
                <div className="w-14 h-14 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-[0_0_30px_rgba(99,102,241,0.3)]">🎵</div>
                <h3 className="text-3xl font-bold mb-3 text-white tracking-tight">Deep Last.fm Integration</h3>
                <p className="text-zinc-400 text-lg font-medium leading-relaxed max-w-md">Connect your account once and instantly share real-time plays, recent scrobbles, and deep listening statistics directly in Discord.</p>
              </div>
            </div>

            {/* Feature 2: Small - Custom Layouts */}
            <div className="md:col-span-1 group relative overflow-hidden bg-zinc-900/40 backdrop-blur-md border border-white/10 p-10 rounded-[2rem] hover:border-purple-500/40 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-500/20 flex flex-col justify-between">
              <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-500/20 rounded-full blur-[80px] group-hover:bg-purple-500/30 transition-colors duration-700"></div>
              
              <div className="absolute top-8 right-8 flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity duration-500">
                <div className="w-4 h-4 rounded-full bg-purple-500/50"></div>
                <div className="w-4 h-4 rounded-md bg-white/20"></div>
                <div className="w-4 h-4 rounded-sm bg-white/10"></div>
              </div>

              <div className="relative z-10 mt-auto">
                <div className="w-12 h-12 bg-purple-500/20 border border-purple-500/30 rounded-2xl flex items-center justify-center text-2xl mb-5">🎨</div>
                <h3 className="text-2xl font-bold mb-2 text-white tracking-tight">Custom Layouts</h3>
                <p className="text-zinc-400 font-medium leading-relaxed">Choose from minimal text to rich, full-sized image embeds for your `/fm` command.</p>
              </div>
            </div>

            {/* Feature 3: Small - Dynamic Avatar */}
            <div className="md:col-span-1 group relative overflow-hidden bg-zinc-900/40 backdrop-blur-md border border-white/10 p-10 rounded-[2rem] hover:border-emerald-500/40 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/20 flex flex-col justify-between">
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-500/20 rounded-full blur-[80px] group-hover:bg-emerald-500/30 transition-colors duration-700"></div>
              
              <div className="absolute top-10 right-10 flex items-center justify-center opacity-30 group-hover:opacity-100 transition-all duration-700">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500/30 border-t-emerald-400 animate-spin"></div>
              </div>

              <div className="relative z-10 mt-auto">
                <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-2xl mb-5">🤖</div>
                <h3 className="text-2xl font-bold mb-2 text-white tracking-tight">Dynamic Avatar</h3>
                <p className="text-zinc-400 font-medium leading-relaxed">The bot dynamically updates its avatar to match the album cover of your currently playing track.</p>
              </div>
            </div>

            {/* Feature 4: Large Span - Lightning Fast */}
            <div className="md:col-span-2 group relative overflow-hidden bg-zinc-900/40 backdrop-blur-md border border-white/10 p-10 rounded-[2rem] hover:border-zinc-400/40 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-white/5 flex flex-col justify-between">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none"></div>
              
              <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.04] pointer-events-none mix-blend-overlay"></div>
              
              <div className="absolute top-10 right-10 hidden sm:flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity duration-500">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">12ms PING</span>
              </div>

              <div className="relative z-10 mt-auto">
                <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-[0_0_30px_rgba(255,255,255,0.1)]">⚡</div>
                <h3 className="text-3xl font-bold mb-3 text-white tracking-tight">Lightning Fast & Reliable</h3>
                <p className="text-zinc-400 text-lg font-medium leading-relaxed max-w-xl">Built on a highly optimized Python backend and Serverless Postgres DB, ensuring your music commands execute instantly with zero latency.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
