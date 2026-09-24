// change this when updating the code to the antigravity ai (patch, minor, major)
"use client";
import { fetchApi } from '@/lib/fetchApi';

import { useSession } from "@/app/providers";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import SupportWidget from "@/components/SupportWidget";
import { Reveal, CountUp, handleSpot } from "@/components/motion";


const INVITE_LINK = "/invite";

const MARQUEE_ITEMS = [
  "NOW PLAYING", "TOP ARTISTS", "SERVER CROWNS", "MUSIC CARDS",
  "WEEKLY RECAPS", "BADGES", "STREAKS", "LEADERBOARDS",
];

function HomeContent() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const detailsParam = searchParams.get("details");
  const frameId = searchParams.get("frame_id");
  const instanceId = searchParams.get("instance_id");
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<{ totalUsers: number, activeMembers: number, serverCount: number, topAvatars?: string[] }>({ totalUsers: 0, activeMembers: 0, serverCount: 0, topAvatars: [] });


  useEffect(() => {
    setMounted(true);
    // Fetch Discord stats
    fetchApi("/api/public/stats")
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);
  }, []);

  if (!mounted || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e0618] text-white">
        <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const displayAvatars = stats.topAvatars || [];

  return (
    <div className="min-h-screen bg-[#0e0618] text-white font-sans selection:bg-fuchsia-500/40 overflow-hidden relative flex flex-col items-center">
      {/* Wrapped-energy mesh background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 flex justify-center items-center">
        <div className="absolute w-[900px] h-[900px] bg-fuchsia-600/25 rounded-full blur-[140px] mix-blend-screen animate-blob"></div>
        <div className="absolute w-[650px] h-[650px] bg-amber-500/15 rounded-full blur-[130px] mix-blend-screen animate-blob animation-delay-200"></div>
        <div className="absolute w-[700px] h-[700px] bg-violet-700/25 rounded-full blur-[130px] mix-blend-screen animate-blob animation-delay-400"></div>
        <div className="absolute w-[400px] h-[400px] bg-lime-400/10 rounded-full blur-[110px] mix-blend-screen animate-blob animation-delay-100"></div>
      </div>

      {/* Dot texture + noise */}
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.05] pointer-events-none z-0 mix-blend-overlay"></div>
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] bg-[size:26px_26px] pointer-events-none z-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black,transparent)]"></div>

      <main className="relative z-10 w-full flex-grow flex flex-col items-center">
        {/* Hero Section */}
        <section className="container relative mx-auto px-4 pt-36 pb-20 text-center flex flex-col items-center min-h-[88vh] justify-center">
          {errorParam && (
            <div className="bg-red-500/20 border-2 border-red-500/60 text-red-200 px-6 py-4 rounded-2xl mb-8 max-w-2xl backdrop-blur-md animate-fade-in-up">
              <h2 className="text-xl font-bold mb-2">Login Failed ({errorParam})</h2>
              <p className="text-sm opacity-80">{detailsParam || "An unknown error occurred during the Discord OAuth process."}</p>
            </div>
          )}

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 border-lime-300/60 bg-lime-300/10 text-lime-200 text-xs font-extrabold mb-8 backdrop-blur-md animate-fade-in-up uppercase tracking-widest -rotate-2">
            <span className="w-2 h-2 rounded-full bg-lime-300 animate-pulse"></span>
            The Ultimate Music Bot
          </div>
          <h1 className="font-display text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold tracking-tight mb-6 leading-[0.95] max-w-6xl mx-auto animate-fade-in-up animation-delay-100">
            Your server has
            <br className="hidden sm:block" /> a{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-amber-300 to-lime-300 drop-shadow-sm animate-shimmer">
              soundtrack.
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-2xl text-zinc-300 max-w-2xl mx-auto mb-10 leading-relaxed font-medium tracking-tight animate-fade-in-up animation-delay-200 px-4">
            Live scrobbles, crowns, music cards, and recaps — your whole music world, right in Discord.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center flex-wrap gap-4 animate-fade-in-up animation-delay-300 w-full sm:w-auto px-4 sm:px-0 max-w-5xl">
            <a
              href={INVITE_LINK}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto justify-center px-8 py-4 bg-white text-zinc-950 font-extrabold rounded-2xl text-sm md:text-base hover:scale-105 hover:-rotate-1 transition-all duration-300 shadow-[6px_6px_0_rgba(255,47,179,0.9)] flex items-center gap-2"
            >
              <span>Add to Discord</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </a>

            <Link
              href="/download"
              className="w-full sm:w-auto justify-center px-8 py-4 bg-lime-300 hover:bg-lime-200 text-zinc-950 font-extrabold rounded-2xl text-sm md:text-base hover:scale-105 hover:rotate-1 transition-all duration-300 shadow-[6px_6px_0_rgba(0,0,0,0.9)] border-2 border-black flex items-center gap-2"
            >
              <span>Download Apps</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </Link>

            {session ? (
              <Link
                href={`/${(session.user.name === "gamernation12" ? "GamerNation12" : session.user.name).replace(/ /g, '-')}`}
                className="w-full sm:w-auto justify-center px-8 py-4 bg-white/5 backdrop-blur-md border-2 border-white/20 hover:border-fuchsia-400/60 hover:bg-white/10 text-white font-bold rounded-2xl text-sm md:text-base transition-all duration-300 flex items-center gap-2"
              >
                Go to Dashboard
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <button
                  onClick={() => { window.location.href = '/api/auth/login'; }}
                  className="w-full sm:w-auto justify-center px-8 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-2xl text-sm md:text-base transition-all duration-300 flex items-center gap-2 shadow-[6px_6px_0_rgba(0,0,0,0.9)] border-2 border-black"
                >
                  Login with Discord
                </button>
                <button
                  onClick={() => { window.location.href = '/api/auth/lastfm/login'; }}
                  className="w-full sm:w-auto justify-center px-8 py-4 bg-[#D51007] hover:bg-[#B00C05] text-white font-bold rounded-2xl text-sm md:text-base transition-all duration-300 hidden sm:flex items-center gap-2 shadow-[6px_6px_0_rgba(0,0,0,0.9)] border-2 border-black"
                >
                  Login with Last.fm
                </button>
              </div>
            )}
          </div>

          {/* Floating hero stickers (desktop only) */}
          <div className="pointer-events-none absolute inset-0 hidden xl:block" aria-hidden="true">
            <div className="absolute left-[6%] top-[30%] animate-float-y" style={{ ["--fl-rot" as string]: "-8deg" }}>
              <div className="w-28 h-28 rounded-full border-4 border-fuchsia-400/60 shadow-[0_0_50px_rgba(255,47,179,0.35)] bg-[repeating-radial-gradient(circle_at_center,#150a24_0px,#150a24_3px,#f0abfc_3px,#f0abfc_4px)] animate-spin-slow"></div>
            </div>
            <div className="absolute right-[7%] top-[26%] animate-float-y" style={{ ["--fl-rot" as string]: "6deg", animationDelay: "1.2s" }}>
              <div className="bg-[#170b28]/90 backdrop-blur-md border-2 border-amber-300/50 rounded-2xl px-4 py-3 shadow-[5px_5px_0_rgba(255,176,32,0.5)]">
                <div className="text-amber-300 font-display font-extrabold text-sm">👑 Crown earned!</div>
                <div className="text-zinc-400 text-xs font-medium">Top listener · David Kushner</div>
              </div>
            </div>
            <div className="absolute right-[10%] bottom-[18%] animate-float-y" style={{ ["--fl-rot" as string]: "-5deg", animationDelay: "2.4s" }}>
              <div className="bg-[#170b28]/90 backdrop-blur-md border-2 border-lime-300/50 rounded-2xl px-4 py-3 shadow-[5px_5px_0_rgba(198,241,53,0.4)]">
                <div className="text-lime-200 font-display font-extrabold text-sm">♫ Now Playing</div>
                <div className="text-zinc-400 text-xs font-medium">Ritual — David Kushner</div>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center gap-3 animate-fade-in-up animation-delay-400">
            <div className="flex -space-x-3">
              {displayAvatars.map((src, i) => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-fuchsia-400/60 bg-zinc-800 overflow-hidden shadow-lg flex items-center justify-center">
                  <img src={src} alt="Top User" className="w-full h-full object-cover" />
                </div>
              ))}
              <div className="w-10 h-10 rounded-full border-2 border-lime-300/60 bg-zinc-900 flex items-center justify-center text-[11px] font-extrabold text-lime-200 shadow-lg shadow-lime-500/10 backdrop-blur-md">
                +{stats.totalUsers ? (stats.totalUsers > displayAvatars.length ? stats.totalUsers - displayAvatars.length : 0) : '...'}
              </div>
            </div>
            <p className="text-sm text-zinc-300 font-medium text-center">
              Join <span className="text-white font-extrabold"><CountUp value={stats.totalUsers} /> Last.fm users</span> in <span className="text-white font-extrabold"><CountUp value={stats.serverCount} /> servers</span> across <br className="sm:hidden" /><span className="text-white font-extrabold"><CountUp value={stats.activeMembers} /> Discord members</span> using the bot right now.
            </p>
          </div>
        </section>

        {/* Marquee divider */}
        <div className="w-full overflow-hidden border-y-2 border-black bg-gradient-to-r from-fuchsia-600 via-amber-400 to-lime-300 py-3 -rotate-1 scale-[1.02] my-4">
          <div className="flex whitespace-nowrap animate-marquee w-max">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0">
                {MARQUEE_ITEMS.map((item) => (
                  <span key={`${copy}-${item}`} className="mx-6 font-display font-extrabold text-zinc-950 text-lg tracking-wide">
                    {item} <span className="ml-6">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Features grid */}
        <section id="features" className="container mx-auto px-4 py-28 w-full max-w-7xl relative z-10">
          <Reveal className="mb-16 text-center flex flex-col items-center gap-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 border-fuchsia-400/50 bg-fuchsia-500/10 text-fuchsia-200 text-xs font-extrabold uppercase tracking-widest rotate-1">
              Features
            </div>
            <h2 className="font-display text-4xl md:text-6xl font-extrabold tracking-tight text-white">
              Everything your <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-amber-300">ears</span> deserve.
            </h2>
            <p className="text-zinc-400 text-lg md:text-xl font-medium max-w-xl leading-relaxed">
              Sharing and discovering music, made effortless, interactive, and beautiful.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:auto-rows-[340px]" onMouseMove={handleSpot}>
            {/* Deep Last.fm */}
            <div className="md:col-span-2 group relative overflow-hidden bg-[#170b28]/80 backdrop-blur-md border-2 border-white/10 bento-spot p-6 md:p-10 rounded-3xl hover:border-fuchsia-400/60 hover:-rotate-[0.5deg] transition-all duration-500 hover:shadow-[8px_8px_0_rgba(255,47,179,0.4)] flex flex-col justify-between">
              <div className="absolute -top-32 -right-32 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-[100px] group-hover:bg-fuchsia-500/30 transition-colors duration-700"></div>
              <div className="relative z-10 mt-auto">
                <div className="w-14 h-14 bg-fuchsia-500/20 border-2 border-fuchsia-400/40 rounded-2xl flex items-center justify-center text-3xl mb-6 rotate-3">🎵</div>
                <h3 className="font-display text-3xl font-extrabold mb-3 text-white tracking-tight">Deep Last.fm Integration</h3>
                <p className="text-zinc-400 text-lg font-medium leading-relaxed max-w-md">Connect once and share real-time plays, recents, and deep stats directly in Discord.</p>
              </div>
            </div>

            {/* Avatar */}
            <div className="md:col-span-1 group relative overflow-hidden bg-[#170b28]/80 backdrop-blur-md border-2 border-white/10 bento-spot p-6 md:p-10 rounded-3xl hover:border-lime-300/60 hover:rotate-[0.5deg] transition-all duration-500 hover:shadow-[8px_8px_0_rgba(198,241,53,0.35)] flex flex-col justify-between">
              <div className="relative z-10 mt-auto">
                <div className="w-12 h-12 bg-lime-300/15 border-2 border-lime-300/40 rounded-2xl flex items-center justify-center text-2xl mb-5 -rotate-3">🤖</div>
                <h3 className="font-display text-2xl font-extrabold mb-2 text-white tracking-tight">Interactive Bot Avatar</h3>
                <p className="text-zinc-400 font-medium leading-relaxed">Preview your album cover as the bot's pfp from <span className="text-zinc-200 font-bold">/fm</span> — then apply it!</p>
              </div>
            </div>

            {/* Crowns */}
            <div className="md:col-span-1 group relative overflow-hidden bg-[#170b28]/80 backdrop-blur-md border-2 border-white/10 bento-spot p-6 md:p-10 rounded-3xl hover:border-amber-300/60 hover:-rotate-[0.5deg] transition-all duration-500 hover:shadow-[8px_8px_0_rgba(255,176,32,0.35)] flex flex-col justify-between">
              <div className="relative z-10 mt-auto">
                <div className="w-12 h-12 bg-amber-300/15 border-2 border-amber-300/40 rounded-2xl flex items-center justify-center text-2xl mb-5 rotate-3">👑</div>
                <h3 className="font-display text-2xl font-extrabold mb-2 text-white tracking-tight">Server Leaderboards</h3>
                <p className="text-zinc-400 font-medium leading-relaxed">Top listeners per artist compete for the #1 crown on your server.</p>
              </div>
            </div>

            {/* Suggestions */}
            <div className="md:col-span-1 group relative overflow-hidden bg-[#170b28]/80 backdrop-blur-md border-2 border-white/10 bento-spot p-6 md:p-10 rounded-3xl hover:border-sky-400/60 hover:rotate-[0.5deg] transition-all duration-500 hover:shadow-[8px_8px_0_rgba(56,189,248,0.35)] flex flex-col justify-between">
              <div className="relative z-10 mt-auto">
                <div className="w-12 h-12 bg-sky-400/15 border-2 border-sky-400/40 rounded-2xl flex items-center justify-center text-2xl mb-5 -rotate-3">💬</div>
                <h3 className="font-display text-2xl font-extrabold mb-2 text-white tracking-tight">Interactive Suggestions</h3>
                <p className="text-zinc-400 font-medium leading-relaxed">Submit ideas via modals and get DMs when admins act on them.</p>
              </div>
            </div>

            {/* Privacy */}
            <div className="md:col-span-1 group relative overflow-hidden bg-[#170b28]/80 backdrop-blur-md border-2 border-white/10 bento-spot p-6 md:p-10 rounded-3xl hover:border-rose-400/60 hover:-rotate-[0.5deg] transition-all duration-500 hover:shadow-[8px_8px_0_rgba(251,113,133,0.35)] flex flex-col justify-between">
              <div className="relative z-10 mt-auto">
                <div className="w-12 h-12 bg-rose-400/15 border-2 border-rose-400/40 rounded-2xl flex items-center justify-center text-2xl mb-5 rotate-3">🔒</div>
                <h3 className="font-display text-2xl font-extrabold mb-2 text-white tracking-tight">Privacy Focused</h3>
                <p className="text-zinc-400 font-medium leading-relaxed">Hide your stats with Private Mode, on the dashboard or via <span className="text-zinc-200 font-bold">/privacy</span>.</p>
              </div>
            </div>

            {/* Spotify */}
            <div className="md:col-span-1 group relative overflow-hidden bg-[#170b28]/80 backdrop-blur-md border-2 border-white/10 bento-spot p-6 md:p-10 rounded-3xl hover:border-emerald-400/60 hover:rotate-[0.5deg] transition-all duration-500 hover:shadow-[8px_8px_0_rgba(52,211,153,0.35)] flex flex-col justify-between">
              <div className="relative z-10 mt-auto">
                <div className="w-12 h-12 bg-emerald-400/15 border-2 border-emerald-400/40 rounded-2xl flex items-center justify-center text-2xl mb-5 -rotate-3">🎧</div>
                <h3 className="font-display text-2xl font-extrabold mb-2 text-white tracking-tight">Spotify Rich Data</h3>
                <p className="text-zinc-400 font-medium leading-relaxed">Preview links, lyrics, and hi-res art enrich every Last.fm lookup.</p>
              </div>
            </div>

            {/* Speed */}
            <div className="md:col-span-2 group relative overflow-hidden bg-[#170b28]/80 backdrop-blur-md border-2 border-white/10 bento-spot p-6 md:p-10 rounded-3xl hover:border-white/40 hover:-rotate-[0.5deg] transition-all duration-500 hover:shadow-[8px_8px_0_rgba(255,255,255,0.25)] flex flex-col justify-between">
              <div className="relative z-10 mt-auto">
                <div className="w-14 h-14 bg-white/10 border-2 border-white/25 rounded-2xl flex items-center justify-center text-3xl mb-6 rotate-2">⚡</div>
                <h3 className="font-display text-3xl font-extrabold mb-3 text-white tracking-tight">Lightning Fast & Reliable</h3>
                <p className="text-zinc-400 text-lg font-medium leading-relaxed max-w-xl">Optimized Python backend + Serverless Postgres. Commands land instantly, zero latency.</p>
              </div>
            </div>

            {/* Music Cards */}
            <div className="md:col-span-1 group relative overflow-hidden bg-[#170b28]/80 backdrop-blur-md border-2 border-white/10 bento-spot p-6 md:p-10 rounded-3xl hover:border-fuchsia-400/60 hover:rotate-[0.5deg] transition-all duration-500 hover:shadow-[8px_8px_0_rgba(255,47,179,0.35)] flex flex-col justify-between">
              <div className="relative z-10 mt-auto">
                <div className="w-12 h-12 bg-fuchsia-500/15 border-2 border-fuchsia-400/40 rounded-2xl flex items-center justify-center text-2xl mb-5 -rotate-3">🎴</div>
                <h3 className="font-display text-2xl font-extrabold mb-2 text-white tracking-tight">Shareable Music Cards</h3>
                <p className="text-zinc-400 font-medium leading-relaxed">Wrapped-style stat cards with your invite link — friends who join earn badges with you.</p>
              </div>
            </div>

            {/* Recaps */}
            <div className="md:col-span-1 group relative overflow-hidden bg-[#170b28]/80 backdrop-blur-md border-2 border-white/10 bento-spot p-6 md:p-10 rounded-3xl hover:border-sky-400/60 hover:-rotate-[0.5deg] transition-all duration-500 hover:shadow-[8px_8px_0_rgba(56,189,248,0.35)] flex flex-col justify-between">
              <div className="relative z-10 mt-auto">
                <div className="w-12 h-12 bg-sky-400/15 border-2 border-sky-400/40 rounded-2xl flex items-center justify-center text-2xl mb-5 rotate-3">📊</div>
                <h3 className="font-display text-2xl font-extrabold mb-2 text-white tracking-tight">Weekly & Monthly Recaps</h3>
                <p className="text-zinc-400 font-medium leading-relaxed">Stats.fm-style recap images with tops and new finds, DM'd to you.</p>
              </div>
            </div>

            {/* Badges */}
            <div className="md:col-span-1 group relative overflow-hidden bg-[#170b28]/80 backdrop-blur-md border-2 border-white/10 bento-spot p-6 md:p-10 rounded-3xl hover:border-orange-400/60 hover:rotate-[0.5deg] transition-all duration-500 hover:shadow-[8px_8px_0_rgba(251,146,60,0.35)] flex flex-col justify-between">
              <div className="relative z-10 mt-auto">
                <div className="w-12 h-12 bg-orange-400/15 border-2 border-orange-400/40 rounded-2xl flex items-center justify-center text-2xl mb-5 -rotate-3">🏅</div>
                <h3 className="font-display text-2xl font-extrabold mb-2 text-white tracking-tight">Badges</h3>
                <p className="text-zinc-400 font-medium leading-relaxed">Earn Recruiter, Royalty, and Dev badges — shown off next to your name.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Community / Support Server Section */}
        <section className="container mx-auto px-4 pb-32 w-full max-w-7xl relative z-10 flex flex-col items-center">
          <Reveal className="flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 border-lime-300/50 bg-lime-300/10 text-lime-200 text-xs font-extrabold mb-6 uppercase tracking-widest rotate-1">
            Community
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4 text-center">
            Need help or want to hang out?
          </h2>
          <p className="text-zinc-400 text-lg font-medium max-w-xl text-center mb-10 leading-relaxed">
            Join the support server for help, suggestions, bug reports, and update news.
          </p>
          </Reveal>
          <Reveal delay={120} className="w-full flex justify-center">
          <SupportWidget />
          </Reveal>
        </section>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0e0618] text-white">
        <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
