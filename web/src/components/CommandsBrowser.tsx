"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, Shield, ArrowUpRight } from "lucide-react";
import { ALL_COMMANDS, COMMAND_CATEGORIES, type BotCommand } from "@/lib/commands";

function matches(command: BotCommand, query: string) {
  if (!query) return true;
  const haystack = [
    command.command,
    command.description,
    command.usage,
    ...(command.aliases || []),
    ...(command.note ? [command.note] : []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export default function CommandsBrowser() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const normalizedQuery = query.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    return COMMAND_CATEGORIES.map((category) => ({
      ...category,
      commands: category.commands.filter(
        (command) =>
          (activeCategory === "all" || activeCategory === category.id) &&
          matches(command, normalizedQuery)
      ),
    })).filter((category) => category.commands.length > 0);
  }, [activeCategory, normalizedQuery]);

  const visibleCount = filteredCategories.reduce(
    (total, category) => total + category.commands.length,
    0
  );

  return (
    <div>
      <div className="sticky top-20 z-20 -mx-4 px-4 py-4 bg-[#0e0618]/90 backdrop-blur-xl border-y border-white/5">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="relative">
            <Search className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search commands, aliases or descriptions..."
              aria-label="Search commands"
              className="w-full rounded-xl border border-white/10 bg-[#170b28]/80 pl-12 pr-12 py-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-500/20 transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear command search"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 styled-scrollbar sm:flex-wrap sm:overflow-visible">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold border transition ${
                activeCategory === "all"
                  ? "bg-fuchsia-500/20 border-fuchsia-400/50 text-fuchsia-200"
                  : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
              }`}
            >
              All commands
            </button>
            {COMMAND_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold border transition ${
                  activeCategory === category.id
                    ? "bg-fuchsia-500/20 border-fuchsia-400/50 text-fuchsia-200"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <span aria-hidden="true">{category.emoji}</span> {category.title}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
            <span aria-live="polite">
              Showing <span className="text-zinc-300 font-bold">{visibleCount}</span> of{" "}
              <span className="text-zinc-300 font-bold">{ALL_COMMANDS.length}</span> commands
            </span>
            <span className="hidden sm:inline">Most commands also work with a comma prefix, e.g. ,fm</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto pt-10 space-y-14">
        {filteredCategories.map((category) => (
          <section key={category.id} id={category.id} className="scroll-mt-48">
            <div className="mb-5">
              <h2 className="text-2xl md:text-3xl font-display font-extrabold text-white flex items-center gap-3">
                <span aria-hidden="true">{category.emoji}</span>
                {category.title}
              </h2>
              <p className="text-zinc-400 text-sm mt-1">{category.description}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {category.commands.map((command) => (
                <article
                  key={`${category.id}-${command.command}`}
                  className="group rounded-2xl border border-white/10 bg-[#170b28]/50 p-5 hover:border-fuchsia-400/30 hover:bg-[#1b0d30]/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <code className="text-lime-300 font-mono text-sm font-bold break-all">
                      {command.command}
                    </code>
                    {command.admin && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                        <Shield className="w-3 h-3" />
                        Admin
                      </span>
                    )}
                  </div>

                  <p className="text-zinc-300 text-sm leading-relaxed mt-2">
                    {command.description}
                  </p>

                  <div className="mt-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                    <code className="text-zinc-400 font-mono text-xs break-all">
                      {command.usage}
                    </code>
                  </div>

                  {(command.aliases?.length || command.note) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                      {command.aliases?.map((alias) => (
                        <span
                          key={alias}
                          className="rounded-md bg-white/5 px-2 py-1 font-mono text-zinc-400"
                        >
                          ,{alias}
                        </span>
                      ))}
                      {command.note && (
                        <span className="text-zinc-500">{command.note}</span>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}

        {filteredCategories.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#170b28]/50 p-10 text-center">
            <p className="text-white font-bold text-lg">No commands found</p>
            <p className="text-zinc-400 text-sm mt-2">
              Try a different search, or{" "}
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveCategory("all");
                }}
                className="text-fuchsia-300 hover:text-fuchsia-200 underline underline-offset-4"
              >
                show every command
              </button>
              .
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-lime-300/20 bg-gradient-to-br from-lime-400/10 via-fuchsia-500/10 to-transparent p-8 text-center">
          <h2 className="text-2xl font-display font-extrabold text-white">
            Ready to try them in Discord?
          </h2>
          <p className="text-zinc-400 text-sm mt-2 max-w-xl mx-auto">
            Invite DJ Scratch, run <code className="text-lime-300">/login</code> to link Last.fm,
            then run <code className="text-lime-300">/fm</code> to see what you&apos;re playing.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/invite"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-2.5 text-sm font-black text-zinc-950 hover:bg-lime-200 transition-colors"
            >
              Add to Discord
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <a
              href="https://discord.gg/MT6d7jh3rv"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-zinc-200 hover:bg-white/10 transition-colors"
            >
              Join the support server
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
