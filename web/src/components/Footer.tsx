"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-zinc-950 py-12 relative z-10 w-full">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="font-bold text-xl text-white">🐐</span>
          <span className="font-semibold text-white">The Goats DJ</span>
          <span className="text-sm">© {new Date().getFullYear()} All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium text-zinc-500">
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <a href="https://discord.gg/9AByF7cM" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Support Server</a>
        </div>
      </div>
    </footer>
  );
}
