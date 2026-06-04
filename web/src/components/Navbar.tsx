"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const isAdmin = (session?.user as any)?.id === "759433582107426816";

  return (
    <nav className="fixed top-0 w-full z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold group-hover:scale-105 transition-transform">
                G
              </div>
              <span className="text-xl font-extrabold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                The Goats DJ
              </span>
            </Link>

            <div className="hidden md:flex space-x-1">
              <Link
                href="/"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname === "/"
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}
              >
                Dashboard
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    pathname === "/admin"
                      ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                      : "text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/5"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin Hub
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {session ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <img
                    src={session.user?.image || ""}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full border border-gray-700"
                  />
                  <span className="text-sm font-medium text-gray-300 hidden sm:block">
                    {session.user?.name}
                  </span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-all"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/api/auth/signin"
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
