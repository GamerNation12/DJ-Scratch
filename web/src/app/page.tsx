"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

const INVITE_LINK = "https://discord.com/oauth2/authorize?client_id=1509709265659760741&permissions=8&scope=bot%20applications.commands";

export default function Home() {
  const { data: session, status } = useSession();
  const [fmMode, setFmMode] = useState<"compact" | "full" | "stats">("full");
  const [showFeatures, setShowFeatures] = useState<boolean>(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (session) {
      fetch("/api/settings")
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            if (data.fmMode) setFmMode(data.fmMode);
            if (data.showFeatures !== undefined) setShowFeatures(data.showFeatures);
          }
        })
        .catch((err) => console.error("Error fetching settings:", err));
    }
  }, [session]);

  const handleUpdateFmMode = async (mode: "compact" | "full" | "stats") => {
    setUpdatingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fmMode: mode }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fmMode) setFmMode(data.fmMode);
      }
    } catch (err) {
      console.error("Error updating settings:", err);
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleToggleFeatures = async () => {
    const newValue = !showFeatures;
    setShowFeatures(newValue);
    setUpdatingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showFeatures: newValue }),
      });
      if (!res.ok) {
        setShowFeatures(!newValue);
      }
    } catch (err) {
      console.error("Error updating feature settings:", err);
      setShowFeatures(!newValue);
    } finally {
      setUpdatingSettings(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden relative">
      {/* Decorative Background Elements */}
      <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-600/10 rounded-full blur-[150px] pointer-events-none z-0" />
      


      <main className="relative z-10 pt-32 pb-20">
        {/* Hero Section */}
        <section className="container mx-auto px-6 pt-16 pb-24 text-center flex flex-col items-center">
          <div className="inline-block px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium mb-8 backdrop-blur-md">
            ✨ The Ultimate Music Experience for Discord
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-extrabold tracking-tighter mb-6 leading-[1.1] max-w-5xl mx-auto">
            Elevate Your Server's <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400">
              Vibe & Stats
            </span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            The Goats DJ seamlessly integrates with Last.fm to bring your music tastes, detailed statistics, and customizable layouts straight to your Discord community.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
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
              <a 
                href="#dashboard"
                className="px-8 py-4 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-semibold rounded-full text-lg transition-all duration-300 cursor-pointer"
              >
                Go to Dashboard
              </a>
            ) : (
              <button 
                onClick={() => signIn("discord")}
                className="px-8 py-4 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-semibold rounded-full text-lg transition-all duration-300 cursor-pointer"
              >
                Login to Dashboard
              </button>
            )}
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container mx-auto px-6 py-24 border-t border-white/5">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why The Goats DJ?</h2>
            <p className="text-zinc-400">Everything you need to show off your music.</p>
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
                desc: "The bot's profile picture automatically syncs with the album cover of the track you are currently listening to, keeping your server fresh."
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
              <div key={i} className="bg-zinc-900/50 border border-zinc-800/50 p-8 rounded-3xl backdrop-blur-sm hover:bg-zinc-900 transition-colors">
                <div className="text-4xl mb-6">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-zinc-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Dashboard Section (Only shown if logged in) */}
        {session && (
          <section id="dashboard" className="container mx-auto px-6 py-24 border-t border-white/5 scroll-mt-24">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Your Dashboard</h2>
                <p className="text-zinc-400">Manage your profile and customize your bot settings.</p>
              </div>

              <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-12 shadow-2xl relative overflow-hidden">
                {/* Inner glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                
                <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                  <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">⚙️</span>
                  Display Preferences
                </h3>
                <p className="text-zinc-400 text-sm mb-10">Configure how your music is displayed when you use the bot commands.</p>

                <div className="flex flex-col gap-10">
                  {/* Layout Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-zinc-300 mb-4">Default /fm Display Layout</label>
                    <div className="grid md:grid-cols-3 gap-4">
                      <button
                        onClick={() => handleUpdateFmMode("compact")}
                        disabled={updatingSettings}
                        className={`group relative overflow-hidden py-8 px-4 rounded-2xl font-medium border text-center transition-all duration-300 cursor-pointer ${
                          fmMode === "compact"
                            ? "bg-indigo-600/20 border-indigo-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.15)]"
                            : "bg-zinc-950/50 border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {fmMode === "compact" && <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />}
                        <div className="text-3xl mb-3 transform group-hover:scale-110 transition-transform">📝</div>
                        <div className="text-lg font-bold">Compact Text</div>
                        <div className="text-sm text-zinc-500 mt-2">fm1 (1-line view)</div>
                      </button>

                      <button
                        onClick={() => handleUpdateFmMode("full")}
                        disabled={updatingSettings}
                        className={`group relative overflow-hidden py-8 px-4 rounded-2xl font-medium border text-center transition-all duration-300 cursor-pointer ${
                          fmMode === "full"
                            ? "bg-indigo-600/20 border-indigo-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.15)]"
                            : "bg-zinc-950/50 border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {fmMode === "full" && <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />}
                        <div className="text-3xl mb-3 transform group-hover:scale-110 transition-transform">🖼️</div>
                        <div className="text-lg font-bold">Full Embed</div>
                        <div className="text-sm text-zinc-500 mt-2">fm2 (detailed visual)</div>
                      </button>

                      <button
                        onClick={() => handleUpdateFmMode("stats")}
                        disabled={updatingSettings}
                        className={`group relative overflow-hidden py-8 px-4 rounded-2xl font-medium border text-center transition-all duration-300 cursor-pointer ${
                          fmMode === "stats"
                            ? "bg-indigo-600/20 border-indigo-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.15)]"
                            : "bg-zinc-950/50 border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {fmMode === "stats" && <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />}
                        <div className="text-3xl mb-3 transform group-hover:scale-110 transition-transform">📊</div>
                        <div className="text-lg font-bold">Stats View</div>
                        <div className="text-sm text-zinc-500 mt-2">fm3 (statistics)</div>
                      </button>
                    </div>
                  </div>

                  {/* Feature Toggles */}
                  <div className="pt-8 border-t border-white/5">
                    <label className="flex items-center justify-between cursor-pointer group p-4 rounded-2xl hover:bg-white/[0.02] transition-colors -mx-4">
                      <div className="pr-4 md:pr-8">
                        <div className="text-lg font-semibold text-white mb-1">Show Featured Artists</div>
                        <div className="text-sm text-zinc-400 leading-relaxed">Automatically extract featured artists from the track name and display them alongside the main artist in embeds.</div>
                      </div>
                      <div className="relative shrink-0">
                        <input 
                          type="checkbox" 
                          className="sr-only" 
                          checked={showFeatures}
                          onChange={handleToggleFeatures}
                          disabled={updatingSettings}
                        />
                        <div className={`block w-16 h-9 rounded-full transition-colors duration-300 border ${showFeatures ? 'bg-emerald-500 border-emerald-400' : 'bg-zinc-800 border-zinc-700'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-7 h-7 rounded-full transition-transform duration-300 shadow-sm ${showFeatures ? 'transform translate-x-7' : ''}`}></div>
                      </div>
                    </label>
                  </div>

                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-6 flex items-start gap-4">
                    <div className="text-indigo-400 text-xl mt-1">💡</div>
                    <p className="text-zinc-300 text-sm leading-relaxed">
                      Even with a custom default set here, you can always override it directly in Discord by explicitly typing <code className="bg-black/40 text-emerald-400 px-2 py-1 rounded-md font-mono border border-white/10">,fm1</code>, <code className="bg-black/40 text-emerald-400 px-2 py-1 rounded-md font-mono border border-white/10">,fm2</code>, or <code className="bg-black/40 text-emerald-400 px-2 py-1 rounded-md font-mono border border-white/10">,fm3</code>.
                    </p>
                  </div>
                </div>

                <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
                  <div className="flex items-center gap-2">
                    <span>Logged in as</span>
                    <strong className="text-white">{session.user?.name}</strong>
                  </div>
                  <span className="text-emerald-400 flex items-center gap-2 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    Settings Synced
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-zinc-950 py-12 relative z-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="font-bold text-xl text-white">🐐</span>
            <span className="font-semibold text-white">The Goats DJ</span>
            <span className="text-sm">© {new Date().getFullYear()} All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-zinc-500">
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="https://discord.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Support Server</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
