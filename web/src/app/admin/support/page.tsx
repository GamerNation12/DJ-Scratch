"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApi } from "@/lib/fetchApi";

type Thread = {
  id: string;
  name: string;
  email: string;
  status: string;
  updated_at: string;
  preview: string | null;
  visitor_msgs: number;
};

type Msg = { id: number; sender: string; body: string; email_sent: boolean; created_at: string };

export default function SupportInbox() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [emailed, setEmailed] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchApi("/api/admin/check");
        const data = await res.json();
        setAllowed(!!(res.ok && data.role));
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetchApi("/api/support-chat");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.threads)) setThreads(data.threads);
    } catch {
      /* ignore */
    }
  }, []);

  const loadMsgs = useCallback(async (id: string) => {
    try {
      const res = await fetchApi(`/api/support-chat?threadId=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.messages)) setMsgs(data.messages);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    loadThreads();
    const id = setInterval(loadThreads, 5000);
    return () => clearInterval(id);
  }, [allowed, loadThreads]);

  useEffect(() => {
    if (!active) return;
    loadMsgs(active);
    const id = setInterval(() => loadMsgs(active), 4000);
    return () => clearInterval(id);
  }, [active, loadMsgs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs.length]);

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || sending || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");
    setSending(true);
    setEmailed(null);
    try {
      const res = await fetchApi("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", threadId: active, body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Send failed");
      setEmailed(!!data?.emailed);
      await loadMsgs(active);
      loadThreads();
    } catch (err: any) {
      setDraft(text);
      alert(err?.message || "Couldn't send");
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    if (!active) return;
    await fetchApi("/api/support-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", threadId: active }),
    });
    loadThreads();
  };

  if (allowed === null) {
    return (
      <div className="min-h-screen bg-[#0e0618] flex items-center justify-center text-white">
        <div className="w-8 h-8 border-2 border-fuchsia-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#0e0618] flex items-center justify-center text-white">
        <p className="text-zinc-400 font-bold">Owner only.</p>
      </div>
    );
  }

  const activeThread = threads.find((t) => t.id === active);

  return (
    <div className="min-h-screen bg-[#0e0618] text-white font-sans">
      <main className="max-w-6xl mx-auto px-4 pt-28 pb-16">
        <h1 className="font-display text-3xl md:text-4xl font-extrabold mb-2">Support inbox</h1>
        <p className="text-zinc-400 text-sm mb-8">
          Replies email the visitor automatically when they&apos;ve left the chat.{" "}
          <span className="text-zinc-500">(Needs RESEND_API_KEY + verified sender for email.)</span>
        </p>
        <div className="grid md:grid-cols-[300px_1fr] gap-4">
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {threads.length === 0 && (
              <p className="text-zinc-500 text-sm p-4">No chats yet.</p>
            )}
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                  active === t.id
                    ? "border-fuchsia-400/60 bg-fuchsia-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm truncate">{t.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === "open" ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-400"}`}>
                    {t.status}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 truncate mt-1">{t.email}</div>
                <div className="text-xs text-zinc-400 truncate mt-1">{t.preview || "—"}</div>
              </button>
            ))}
          </div>
          <div className="bg-[#170b28]/80 border-2 border-white/10 rounded-3xl p-5 flex flex-col min-h-[60vh]">
            {!active ? (
              <p className="text-zinc-500 text-sm m-auto">Pick a chat. 👈</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold">{activeThread?.name}</div>
                    <div className="text-xs text-zinc-500">{activeThread?.email}</div>
                  </div>
                  <button onClick={close} className="text-xs font-bold text-zinc-400 hover:text-white underline">
                    Close chat
                  </button>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto pr-1 mb-4 max-h-[50vh]">
                  {msgs.map((m) => (
                    <div key={m.id} className={`flex ${m.sender === "owner" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                        m.sender === "owner"
                          ? "bg-indigo-600 text-white rounded-br-md"
                          : "bg-white/10 border border-white/10 rounded-bl-md"
                      }`}>
                        {m.body}
                        {m.sender === "owner" && m.email_sent && (
                          <div className="text-[10px] opacity-70 mt-1">✉️ emailed</div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                {emailed !== null && (
                  <p className="text-xs mb-2 font-bold ${emailed ? 'text-emerald-300' : 'text-zinc-500'}">
                    {emailed ? "✉️ They were away — reply emailed." : "They're here — no email needed."}
                  </p>
                )}
                <form onSubmit={reply} className="flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Reply…"
                    maxLength={3000}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-fuchsia-400/60"
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="px-5 py-3 bg-white text-zinc-950 font-extrabold rounded-xl text-sm disabled:opacity-60"
                  >
                    Send
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
