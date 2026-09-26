"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

const FAQS = [
  {
    q: "The bot isn't responding. Is it down?",
    a: "Restarts take about a minute (status shows it). If commands fail longer than that, check the support Discord or try again — AutoMod sometimes blocks responses with flagged words.",
  },
  {
    q: "My scrobbles aren't showing / look frozen.",
    a: "If /fm says you were listening hours ago, your scrobbler is stuck. Reconnect it in your music app's settings, or run ,outofsync in Discord. New scrobbles appear within a minute or two.",
  },
  {
    q: "I can't log in (website or Discord Activity).",
    a: "Log into the website (dj-scratch.vercel.app) with Discord first, then open the Activity and log in there — Discord connects instantly. Last.fm always opens in your real browser, since it can't log in inside the Activity.",
  },
  {
    q: "How do I link Spotify?",
    a: "Run /login in Discord and hit “Login with Spotify”, or use the Music tab on the website. Note: Spotify requires Premium for remote playback control.",
  },
  {
    q: "How do I delete my data / go private?",
    a: "Use /privacy for private mode, /logout to unlink accounts. Inactive accounts (60+ days, warned first by DM) are purged automatically.",
  },
  {
    q: "I invited a friend but nobody got badges.",
    a: "Both sides earn badges only after the friend opens YOUR invite link (?ref= code) AND links Last.fm. Check your counts with ,badges in Discord.",
  },
  {
    q: "I'm not getting recap DMs.",
    a: "Recap images need open DMs — with them closed, the recap appears the next time you run any command instead. Weekly recaps go out at each week rollover.",
  },
];

const TOPICS = ["General help", "Bug report", "Account / login", "Privacy / data", "Other"];

export default function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState<number | null>(0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, topic, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Send failed");
      setSent(true);
      setName("");
      setEmail("");
      setMessage("");
      toast.success("Ticket sent! We'll reply by email.");
    } catch (err: any) {
      toast.error(err?.message || "Couldn't send — try again later.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0618] text-white font-sans relative overflow-hidden flex flex-col items-center">
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex justify-center items-center">
        <div className="absolute w-[800px] h-[800px] bg-fuchsia-600/15 rounded-full blur-[130px] mix-blend-screen animate-blob"></div>
        <div className="absolute w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[120px] mix-blend-screen animate-blob animation-delay-200"></div>
      </div>

      <main className="relative z-10 w-full max-w-3xl px-4 sm:px-6 pt-32 pb-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2 border-lime-300/50 bg-lime-300/10 text-lime-200 text-xs font-extrabold mb-6 uppercase tracking-widest -rotate-1">
            No Discord needed
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
            How can we{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-amber-300">
              help?
            </span>
          </h1>
          <p className="text-zinc-400 text-lg font-medium">
            Answers first, human reply by email if you still need one.
          </p>
        </div>

        <div className="space-y-3 mb-14">
          {FAQS.map((f, i) => (
            <div
              key={i}
              className="bg-[#170b28]/80 backdrop-blur-md border-2 border-white/10 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
              >
                <span className="font-bold text-white text-sm md:text-base">{f.q}</span>
                <span className={`text-fuchsia-300 transition-transform duration-300 ${open === i ? "rotate-180" : ""}`}>
                  ▾
                </span>
              </button>
              {open === i && (
                <p className="px-5 pb-5 text-sm text-zinc-400 leading-relaxed animate-fade-in-up">{f.a}</p>
              )}
            </div>
          ))}
        </div>

        <div className="bg-[#170b28]/80 backdrop-blur-md border-2 border-white/10 rounded-3xl p-6 md:p-8">
          <h2 className="font-display text-2xl font-extrabold text-white mb-1">Contact us</h2>
          <p className="text-zinc-400 text-sm mb-6">
            No Discord account needed — we reply by email.
          </p>
          {sent ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
              <div className="text-3xl mb-2">✅</div>
              <div className="font-bold text-white">Ticket received!</div>
              <div className="text-sm text-zinc-400 mt-1">We&apos;ll get back to you by email.</div>
              <button
                onClick={() => setSent(false)}
                className="mt-4 text-xs font-bold text-zinc-300 hover:text-white underline"
              >
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  maxLength={120}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-fuchsia-400/60"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email for the reply"
                  required
                  type="email"
                  maxLength={200}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-fuchsia-400/60"
                />
              </div>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-fuchsia-400/60"
              >
                {TOPICS.map((t) => (
                  <option key={t} value={t} className="bg-zinc-900">
                    {t}
                  </option>
                ))}
              </select>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's going on? Include your Last.fm username if relevant."
                required
                rows={5}
                maxLength={3000}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-fuchsia-400/60 resize-y"
              />
              <button
                type="submit"
                disabled={sending}
                className="w-full sm:w-auto px-8 py-3 bg-white text-zinc-950 font-extrabold rounded-2xl text-sm hover:scale-[1.02] transition-all shadow-[5px_5px_0_rgba(255,47,179,0.9)] disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send ticket"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-zinc-500 text-sm mt-10">
          Prefer Discord? Join the{" "}
          <a href="https://discord.gg/53sxaVWn92" target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-white font-bold">
            support server
          </a>
          .
        </p>
      </main>
    </div>
  );
}
