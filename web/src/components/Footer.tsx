"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-zinc-950 py-12 relative z-10 w-full mt-auto">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="font-bold text-xl text-white opacity-80 hover:opacity-100 transition-opacity cursor-pointer grayscale hover:grayscale-0">💿</span>
          <span className="font-semibold text-zinc-300">DJ Scratch</span>
          <span className="text-xs ml-2">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-6 text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <a href="https://discord.gg/9AByF7cM" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Support</a>
        </div>
      </div>
    </footer>
  );
}
