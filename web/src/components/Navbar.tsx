"use client";

import Link from "next/link";
import { useSession } from "@/app/providers";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function Navbar() {
  const { data: session, logout } = useSession();
  const pathname = usePathname();
  const [botMode, setBotMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);

  useEffect(() => {
    const handleStorage = () => {
      setBotMode(localStorage.getItem("botMode") === "true");
    };
    handleStorage();
    window.addEventListener("botModeToggled", handleStorage);
    return () => window.removeEventListener("botModeToggled", handleStorage);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (session) {
      import('@/lib/fetchApi').then(({ fetchApi }) => {
        fetchApi("/api/admin/check")
          .then(res => res.json())
          .then(data => {
            if (data.role) {
              setIsAdmin(true);
              setAdminRole(data.role);
            } else {
              setIsAdmin(false);
            }
          })
          .catch(console.error);
      });
    } else {
      setIsAdmin(false);
    }
  }, [session]);

  const displayName = botMode ? "DJ Scratch" : session?.user?.name;
  const displayImage = botMode ? "/logo.png" : session?.user?.image || "";

  return (
    <div className="fixed top-0 w-full z-50 px-4 sm:px-6 lg:px-8 pt-4 pointer-events-none">
      <nav className="max-w-7xl mx-auto bg-zinc-950/50 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 pointer-events-auto">
        <div className="flex justify-between h-14 items-center px-4">
          <div className="flex items-center space-x-4">
            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden text-zinc-400 hover:text-white transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            <Link href="/" className="flex items-center gap-2 group">
              <img 
                src="/logo.png" 
                alt="DJ Scratch Logo" 
                className="w-8 h-8 rounded-lg group-hover:scale-105 transition-transform"
              />
              <span className="text-lg font-bold bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent hidden sm:block">
                DJ Scratch
              </span>
            </Link>

            <div className="hidden md:flex space-x-2 border-l border-white/10 pl-6">
              <Link
                href="/"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  pathname === "/"
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Home
              </Link>
              <Link 
                href={session ? `/${session.user.name === "gamernation12" ? "GamerNation12" : session.user.name}` : "/api/auth/login"}
                onClick={(e) => {
                  if (!session) {
                    e.preventDefault();
                    window.location.href = "/api/auth/login";
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  pathname !== "/"
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/leaderboard"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  pathname === "/leaderboard"
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Leaderboard
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                    pathname === "/admin"
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      : "text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  Admin
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4">
            {session ? (
              <div className="flex items-center gap-2 sm:gap-4">
                <a 
                  href="https://discord.com/oauth2/authorize?client_id=1521582398188290049&permissions=347200&scope=bot%20applications.commands"
                  target="_blank" 
                  rel="noreferrer"
                  className="hidden lg:flex text-xs font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg transition-all"
                >
                  Invite
                </a>
                <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-full border border-white/5">
                  <img
                    src={displayImage}
                    alt="Avatar"
                    className="w-6 h-6 rounded-full border border-zinc-700"
                  />
                  <span className="text-xs font-medium text-zinc-300 hidden sm:block pr-2">
                    {displayName}
                  </span>
                </div>
                <button
                  onClick={() => logout()}
                  className="hidden sm:block px-3 py-1.5 text-xs font-medium text-red-400/80 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <a 
                  href="https://discord.com/oauth2/authorize?client_id=1521582398188290049&permissions=347200&scope=bot%20applications.commands"
                  target="_blank" 
                  rel="noreferrer"
                  className="hidden md:flex text-xs font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg transition-all"
                >
                  Invite
                </a>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { window.location.href = '/api/auth/login'; }}
                    className="px-4 py-1.5 text-sm font-medium text-white bg-[#5865F2] hover:bg-[#4752C4] rounded-lg shadow-lg shadow-[#5865F2]/20 transition-all"
                  >
                    Discord
                  </button>
                  <button
                    onClick={() => { window.location.href = '/api/auth/lastfm/login'; }}
                    className="px-4 py-1.5 text-sm font-medium text-white bg-[#D51007] hover:bg-[#B00C05] rounded-lg shadow-lg shadow-[#D51007]/20 transition-all hidden sm:block"
                  >
                    Last.fm
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-20 left-4 right-4 bg-zinc-950/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black pointer-events-auto animate-fade-in-up">
          <div className="flex flex-col space-y-2">
            <Link
              href="/"
              className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                pathname === "/"
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Home
            </Link>
            <Link 
              href={session ? `/${session.user.name === "gamernation12" ? "GamerNation12" : session.user.name}` : "/api/auth/login"}
              onClick={(e) => {
                if (!session) {
                  e.preventDefault();
                  window.location.href = "/api/auth/login";
                }
              }}
              className={`block px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                pathname !== "/"
                  ? "bg-white/10 text-white" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/leaderboard"
              className={`block px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                pathname === "/leaderboard"
                  ? "bg-white/10 text-white" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              Leaderboard
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  pathname === "/admin"
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                Admin
              </Link>
            )}
            <div className="h-px bg-white/10 my-2"></div>
            <a 
              href="https://discord.com/oauth2/authorize?client_id=1521582398188290049&permissions=347200&scope=bot%20applications.commands"
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-3 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              Invite Bot
            </a>
            {session && (
              <button
                onClick={() => logout()}
                className="px-4 py-3 rounded-xl text-sm font-medium text-red-400/80 hover:text-red-400 hover:bg-red-400/10 transition-all text-left w-full"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

