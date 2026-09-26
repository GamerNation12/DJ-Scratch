"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith('/activity')) return null;

  return (
    <footer className="border-t border-fuchsia-500/10 bg-[#0e0618] py-12 relative z-10 w-full mt-auto">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent"></div>
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="font-bold text-xl text-white opacity-80 hover:opacity-100 transition-opacity cursor-pointer grayscale hover:grayscale-0"><img src="https://cdn.discordapp.com/emojis/1527125818713837701.gif" alt="VinylRecord" className="w-6 h-6 inline-block" /></span>
          <span className="font-display font-extrabold text-zinc-200">DJ Scratch</span>
          <span className="text-xs ml-2">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-6 text-xs font-semibold text-zinc-500 uppercase tracking-widest">
          <Link href="/terms" className="hover:text-candy transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-candy transition-colors">Privacy</Link>
          <Link href="/guidelines" className="hover:text-candy transition-colors">Standards</Link>
          <Link href="/support" className="hover:text-candy transition-colors">Help</Link>
          <a href="https://discord.gg/53sxaVWn92" target="_blank" rel="noreferrer" className="hover:text-candy transition-colors">Support</a>
        </div>
      </div>
    </footer>
  );
}
