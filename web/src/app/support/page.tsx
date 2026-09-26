"use client";

import { useEffect, useRef, useState } from "react";
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

type Msg = { id: number; sender: string; body: string; created_at: string };

export default function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [first, setFirst] = useState("");
  const [starting, setStarting] = useState(false);
  const [thread, setThread] = useState<{ id: string; secret: string } | null>(null);
  const [closed, setClosed] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Resume an existing chat.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("dj_support_thread");
      if (raw) {
        const t = JSON.parse(raw);
        if (t?.id && t?.secret) setThread(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Poll for replies (also marks you present so no email is sent).
  useEffect(() => {
    if (!thread) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/support-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "poll", threadId: thread.id, secret: thread.secret }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 404) {
            try {
              localStorage.removeItem("dj_support_thread");
            } catch {
              /* ignore */
            }
            setThread(null);
          }
          return;
        }
        setMsgs(Array.isArray(data.messages) ? data.messages : []);
        setClosed(data.status === "closed");
      } catch {
        /* offline — retry next tick */
      }
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => {
      clearInterval(id);
      cancelled = true;
    };
  }, [thread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs.length]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (starting) return;
    setStarting(true);
    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message: first }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't start chat");
      if (!data?.threadId) throw new Error("Couldn't start chat");
      const t = { id: data.threadId, secret: data.secret };
      try {
        localStorage.setItem("dj_support_thread", JSON.stringify(t));
      } catch {
        /* ignore */
      }
      setThread(t);
      setFirst("");
      toast.success("Chat started! We'll reply here — or by email if you leave.");
    } catch (err: any) {
      toast.error(err?.message || "Couldn't start chat — try again.");
    } finally {
      setStarting(false);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thread || sending || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    setSending(true);
    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", threadId: thread.id, secret: thread.secret, body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't send");
      setMsgs(Array.isArray(data.messages) ? data.messages : []);
      setClosed(data.status === "closed");
    } catch (err: any) {
      setDraft(text);
      toast.error(err?.message || "Couldn't send — try again.");
    } finally {
      setSending(false);
    }
  };

  const newChat = () => {
    try {
      localStorage.removeItem("dj_support_thread");
    } catch {
      /* ignore */
    }
    setThread(null);
    setMsgs([]);
    setClosed(false);
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
            Answers first, live chat if you still need us.
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
          <h2 className="font-display text-2xl font-extrabold text-white mb-1">Live chat</h2>
          <p className="text-zinc-400 text-sm mb-6">
            No Discord account needed. Stay here to chat live — leave and we&apos;ll email you the reply.
          </p>

          {!thread ? (
            <form onSubmit={start} className="space-y-4">
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
                  placeholder="Email (for replies if you leave)"
                  required
                  type="email"
                  maxLength={200}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-fuchsia-400/60"
                />
              </div>
              <textarea
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                placeholder="What's going on? Include your Last.fm username if relevant."
                rows={3}
                maxLength={3000}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-fuchsia-400/60 resize-y"
              />
              <button
                type="submit"
                disabled={starting}
                className="w-full sm:w-auto px-8 py-3 bg-white text-zinc-950 font-extrabold rounded-2xl text-sm hover:scale-[1.02] transition-all shadow-[5px_5px_0_rgba(255,47,179,0.9)] disabled:opacity-60"
              >
                {starting ? "Starting…" : "Start chat"}
              </button>
            </form>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${closed ? "text-zinc-400 border-white/10 bg-white/5" : "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"}`}>
                  <span className={`w-2 h-2 rounded-full ${closed ? "bg-zinc-500" : "bg-emerald-400 animate-pulse"}`}></span>
                  {closed ? "Closed" : "Live — typically replies fast"}
                </span>
                <button onClick={newChat} className="text-xs font-bold text-zinc-400 hover:text-white underline">
                  New chat
                </button>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1 mb-4">
                {msgs.length === 0 && (
                  <p className="text-sm text-zinc-500 text-center py-6">
                    Say hi below — support sees it instantly. 👋
                  </p>
                )}
                {msgs.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "visitor" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        m.sender === "visitor"
                          ? "bg-fuchsia-600 text-white rounded-br-md"
                          : "bg-white/10 border border-white/10 text-zinc-100 rounded-bl-md"
                      }`}
                    >
                      {m.body}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              {closed ? (
                <p className="text-sm text-zinc-500 text-center">
                  This chat is closed — start a new one above if you need more help.
                </p>
              ) : (
                <form onSubmit={send} className="flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a message…"
                    maxLength={3000}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-fuchsia-400/60"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="px-5 py-3 bg-white text-zinc-950 font-extrabold rounded-xl text-sm hover:scale-[1.02] transition-all disabled:opacity-60"
                  >
                    Send
                  </button>
                </form>
              )}
            </>
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
