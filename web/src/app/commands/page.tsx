import type { Metadata } from "next";
import CommandsBrowser from "@/components/CommandsBrowser";
import { ALL_COMMANDS } from "@/lib/commands";

const BASE = "https://dj-scratch.is-a-fullstack.dev";

export const metadata: Metadata = {
  title: "Discord Bot Commands",
  description:
    "Browse every DJ Scratch Discord command: now-playing cards, top artists and tracks, server crowns, who-knows lookups, recaps, Spotify controls and more.",
  alternates: { canonical: `${BASE}/commands` },
  openGraph: {
    title: "DJ Scratch Discord Bot Commands",
    description:
      "Every DJ Scratch slash command in one place, with usage examples, aliases and admin-only commands.",
    url: `${BASE}/commands`,
    siteName: "DJ Scratch",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: `${BASE}/logo.png?v=2`,
        width: 1024,
        height: 1024,
        alt: "DJ Scratch Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DJ Scratch Discord Bot Commands",
    description:
      "Browse every DJ Scratch slash command, alias and usage example.",
    images: [`${BASE}/logo.png?v=2`],
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "DJ Scratch Discord bot commands",
  description:
    "The complete list of DJ Scratch slash commands for Last.fm and Spotify music stats.",
  numberOfItems: ALL_COMMANDS.length,
  itemListOrder: "https://schema.org/ItemListUnordered",
  itemListElement: ALL_COMMANDS.map((command, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: command.command,
    description: command.description,
    url: `${BASE}/commands`,
  })),
};

export default function CommandsPage() {
  return (
    <div className="min-h-screen bg-[#0e0618] text-white font-sans overflow-x-clip relative">
      <div className="fixed top-0 left-1/4 w-1/2 h-[500px] bg-fuchsia-600/10 rounded-full blur-[160px] pointer-events-none z-0" />
      <div className="fixed top-40 right-0 w-1/3 h-[360px] bg-lime-400/5 rounded-full blur-[140px] pointer-events-none z-0" />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 relative z-10 max-w-5xl">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c"),
          }}
        />

        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-fuchsia-200 mb-6">
            <span className="w-2 h-2 rounded-full bg-lime-300 animate-pulse" />
            Live command reference
          </div>

          <h1 className="text-4xl md:text-6xl font-display font-black bg-clip-text text-transparent bg-gradient-to-r from-lime-200 via-white to-fuchsia-300 mb-4">
            Discord Commands
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Everything DJ Scratch can do, from now-playing cards to server crowns,
            recaps, who-knows lookups and Spotify controls.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-xs font-bold">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-zinc-300">
              {ALL_COMMANDS.length} commands
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-zinc-300">
              Slash + prefix
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-zinc-300">
              Free to use
            </span>
          </div>
        </header>

        <CommandsBrowser />
      </main>
    </div>
  );
}
