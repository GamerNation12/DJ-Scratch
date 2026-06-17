"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [botMode, setBotMode] = useState(false);

  useEffect(() => {
    const handleStorage = () => {
      setBotMode(localStorage.getItem("botMode") === "true");
    };
    handleStorage();
    window.addEventListener("botModeToggled", handleStorage);
    return () => window.removeEventListener("botModeToggled", handleStorage);
  }, []);

  const isAdmin = (session?.user as any)?.id === "759433582107426816";

  const displayName = botMode ? "The Goats DJ" : session?.user?.name;
  const displayImage = botMode ? "/logo.png" : session?.user?.image || "";

  return (
    <div className="fixed top-0 w-full z-50 px-4 sm:px-6 lg:px-8 pt-4 pointer-events-none">
      <nav className="max-w-7xl mx-auto bg-zinc-950/50 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 pointer-events-auto">
        <div className="flex justify-between h-14 items-center px-4">
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center gap-2 group">
              <img 
                src="/logo.png" 
                alt="The Goats DJ Logo" 
                className="w-8 h-8 rounded-lg group-hover:scale-105 transition-transform"
              />
              <span className="text-lg font-bold bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                The Goats DJ
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
                href="/dashboard"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  pathname === "/dashboard"
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                Dashboard
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

          <div className="flex items-center space-x-4">
            {session ? (
              <div className="flex items-center gap-4">
                <a 
                  href="https://discord.com/oauth2/authorize?client_id=1509709265659760741&permissions=8&scope=bot%20applications.commands"
                  target="_blank" 
                  rel="noreferrer"
                  className="hidden md:flex text-xs font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg transition-all"
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
                  onClick={() => signOut()}
                  className="px-3 py-1.5 text-xs font-medium text-red-400/80 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <a 
                  href="https://discord.com/oauth2/authorize?client_id=1509709265659760741&permissions=8&scope=bot%20applications.commands"
                  target="_blank" 
                  rel="noreferrer"
                  className="hidden md:flex text-xs font-semibold text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg transition-all"
                >
                  Invite
                </a>
                <Link
                  href="/api/auth/signin"
                  className="px-4 py-1.5 text-sm font-medium text-zinc-950 bg-white hover:bg-zinc-200 rounded-lg shadow-lg shadow-white/10 transition-all"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
