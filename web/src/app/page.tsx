"use client";

import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";

const INVITE_LINK = "https://discord.com/oauth2/authorize?client_id=1509709265659760741&permissions=8&scope=bot%20applications.commands";

export default function Home() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden relative flex flex-col items-center">
      {/* Decorative Background Elements */}
      <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-600/10 rounded-full blur-[150px] pointer-events-none z-0" />
      
      <main className="relative z-10 w-full flex-grow flex flex-col items-center">
        {/* Hero Section */}
        <section className="container mx-auto px-6 pt-24 pb-32 text-center flex flex-col items-center">
          <div className="inline-block px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium mb-8 backdrop-blur-md animate-fade-in-up">
            ✨ The Ultimate Music Experience for Discord
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-extrabold tracking-tighter mb-6 leading-[1.1] max-w-5xl mx-auto animate-fade-in-up animation-delay-100">
            Elevate Your Server's <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400">
              Vibe & Stats
            </span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up animation-delay-200">
            The Goats DJ seamlessly integrates with Last.fm to bring your music tastes, detailed statistics, and customizable layouts straight to your Discord community.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 animate-fade-in-up animation-delay-300">
            <a 
              href={INVITE_LINK}
              target="_blank"
              rel="noreferrer"
              className="px-8 py-4 bg-white text-zinc-950 font-bold rounded-full text-lg hover:scale-105 transition-transform duration-300 shadow-[0_0_40px_rgba(255,255,255,0.3)] flex items-center gap-2"
            >
              <span>Add to Discord</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </a>
            {session ? (
              <Link 
                href="/dashboard"
                className="px-8 py-4 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-semibold rounded-full text-lg transition-all duration-300 shadow-lg shadow-black/50"
              >
                Go to Dashboard
              </Link>
            ) : (
              <button 
                onClick={() => signIn("discord")}
                className="px-8 py-4 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-semibold rounded-full text-lg transition-all duration-300 shadow-lg shadow-black/50"
              >
                Login to Dashboard
              </button>
            )}
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container mx-auto px-6 py-24 border-t border-white/5 w-full">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">Why The Goats DJ?</h2>
            <p className="text-zinc-400 text-lg">Everything you need to show off your music.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {[
              {
                icon: "🎵",
                title: "Deep Last.fm Integration",
                desc: "Connect your Last.fm account to instantly share your current playing tracks, recent scrobbles, and top artists with your server."
              },
              {
                icon: "🤖",
                title: "Dynamic Bot Avatar",
                desc: "Users can manually set the bot's profile picture to match their current album cover directly from their music embeds."
              },
              {
                icon: "🎨",
                title: "Customizable Layouts",
                desc: "Choose between compact text, beautiful full image embeds, or detailed statistics views. Make your \"/fm\" command truly yours."
              },
              {
                icon: "⚡",
                title: "Fast & Reliable",
                desc: "Built with modern architecture to ensure your music stats load instantly without any delay, bringing a premium feel to your server."
              }
            ].map((feature, i) => (
              <div key={i} className="group bg-zinc-900/40 border border-zinc-800/50 p-8 rounded-3xl backdrop-blur-sm hover:bg-zinc-900 hover:border-indigo-500/30 hover:shadow-[0_0_30px_rgba(99,102,241,0.1)] transition-all duration-500">
                <div className="text-4xl mb-6 transform group-hover:scale-110 group-hover:-translate-y-2 transition-transform duration-500">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-3 text-white group-hover:text-indigo-300 transition-colors">{feature.title}</h3>
                <p className="text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
