import { useCallback, useEffect, useRef, useState } from 'react';
import { LifeBuoy, Send, RotateCcw, Mail, MessageSquare } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';
import { getToken, decodeUser } from '../lib/auth';
import { Card, Spinner } from '../components/ui';
import { API_BASE } from '../lib/config';

const STORAGE_KEY = 'ds_support_thread';
const POLL_MS = 4000;

interface SupportThread {
  threadId: string;
  secret: string;
}

interface ChatBubble {
  id: string;
  mine: boolean;
  text: string;
  at: string;
}

function loadThread(): SupportThread | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SupportThread;
    if (parsed?.threadId && parsed?.secret) return parsed;
    return null;
  } catch {
    return null;
  }
}

function normalizeMessages(raw: unknown): ChatBubble[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((m, i) => {
    const o = (m || {}) as Record<string, unknown>;
    const role = String(o.role ?? o.from ?? o.author ?? o.sender ?? '').toLowerCase();
    const text = String(o.text ?? o.content ?? o.message ?? o.body ?? '');
    const atRaw = o.created_at ?? o.createdAt ?? o.at ?? o.timestamp ?? o.sent_at ?? '';
    let at = '';
    try {
      at = atRaw ? new Date(String(atRaw)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    } catch {
      at = '';
    }
    const mine =
      role === 'guest' || role === 'user' || role === 'visitor' || role === 'me';
    return { id: String(o.id ?? o._id ?? i), mine, text, at };
  });
}

export default function SupportPage({ token }: { token: string | null }) {
  const authToken = token ?? getToken();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!authToken) {
      setIsAdmin(false);
      return;
    }
    api
      .checkAdmin(authToken)
      .then((r) => setIsAdmin(r.role === 'admin' || r.role === 'owner'))
      .catch(() => setIsAdmin(false));
  }, [authToken]);

  // ---------- shared scroll logic ----------
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 50);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Only auto-scroll to the bottom when the user is already at the bottom.
  // If they scrolled up to read, polling won't yank the view back down.
  useEffect(() => {
    if (!atBottom) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadCount(0);
  }, [atBottom]);

  const jumpToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadCount(0);
    setAtBottom(true);
  };

  const renderBubbles = (msgs: ChatBubble[]) => (
    <>
      {msgs.length === 0 ? (
        <p className="text-zinc-500 text-sm text-center py-8">No messages yet — say hello below.</p>
      ) : (
        msgs.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
              m.mine ? 'bg-indigo-600' : 'bg-zinc-800 border border-white/5'
            }`}>
              <p className="break-words text-sm">{m.text}</p>
              {m.at && <p className="text-[10px] mt-1 opacity-60">{m.at}</p>}
            </div>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </>
  );

  // =========================================================================
  // ADMIN MODE — unified support inbox (replaces the admin support tab)
  // =========================================================================
  if (isAdmin) {
    const [threads, setThreads] = useState<Array<{
      id: string;
      name: string;
      email: string;
      status: string;
      updated_at: string;
      preview: string | null;
      visitor_msgs: number;
    }>>([]);
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
    const [adminMsgs, setAdminMsgs] = useState<ChatBubble[]>([]);
    const [adminDraft, setAdminDraft] = useState('');
    const [adminLoading, setAdminLoading] = useState(false);

    const loadThreads = useCallback(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/support-chat`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setThreads(Array.isArray(data.threads) ? data.threads : []);
        }
      } catch {}
    }, [authToken]);

    const loadMsgs = useCallback(async (id: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/support-chat?threadId=${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const raw = Array.isArray(data.messages) ? data.messages : [];
          const incoming = raw.map((m: any, i: number) => ({
            id: String(m.id ?? i),
            mine: String(m.sender ?? '').toLowerCase() === 'owner',
            text: String(m.body ?? m.text ?? ''),
            at: String(m.created_at ?? m.createdAt ?? ''),
          }));
          setAdminMsgs(incoming);
        }
      } catch {}
    }, [authToken]);

    const pollAdmin = useCallback(async () => {
      if (!activeThreadId) return;
      try {
        const res = await fetch(`${API_BASE}/api/support-chat?threadId=${encodeURIComponent(activeThreadId)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const raw = Array.isArray(data.messages) ? data.messages : [];
          const incoming = raw.map((m: any, i: number) => ({
            id: String(m.id ?? i),
            mine: String(m.sender ?? '').toLowerCase() === 'owner',
            text: String(m.body ?? m.text ?? ''),
            at: String(m.created_at ?? m.createdAt ?? ''),
          }));
          setAdminMsgs((prev) => {
            const prevById = new Map(prev.map((m) => [m.id, m]));
            const merged: ChatBubble[] = [];
            const seen = new Set<string>();
            for (const m of incoming) { merged.push(m); seen.add(m.id); }
            for (const m of prev) { if (!seen.has(m.id)) merged.push(m); }
            return merged;
          });
        }
      } catch {}
    }, [activeThreadId, authToken]);

    useEffect(() => {
      loadThreads();
    }, [loadThreads]);

    useEffect(() => {
      if (!activeThreadId) return;
      pollAdmin();
      const id = setInterval(pollAdmin, POLL_MS);
      return () => clearInterval(id);
    }, [activeThreadId, pollAdmin]);

    const sendReply = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeThreadId || !adminDraft.trim()) return;
      try {
        const res = await fetch(`${API_BASE}/api/support-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ action: 'reply', threadId: activeThreadId, body: adminDraft.trim() }),
        });
        if (!res.ok) throw new Error('Send failed');
        setAdminDraft('');
        await loadMsgs(activeThreadId);
      } catch (e: any) {
        toast.error(e?.message || 'Couldn\'t send');
      }
    };

    const closeThread = async () => {
      if (!activeThreadId) return;
      try {
        const res = await fetch(`${API_BASE}/api/support-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ action: 'close', threadId: activeThreadId }),
        });
        if (!res.ok) throw new Error('Close failed');
        setActiveThreadId(null);
        setAdminMsgs([]);
        await loadThreads();
      } catch (e: any) {
        toast.error(e?.message || 'Failed to close');
      }
    };

    return (
      <div className="max-w-7xl mx-auto pb-28 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-black flex items-center gap-3">
            <Mail size={28} className="text-indigo-400" /> Support Inbox
          </h1>
          <button
            onClick={loadThreads}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-bold text-zinc-300"
          >
            <MessageSquare size={14} /> Refresh
          </button>
        </div>
        <Card className="p-6 flex flex-col h-full">
          <div className="mt-4 grid md:grid-cols-[300px_1fr] gap-4 h-[60vh]">
            <div className="space-y-2 max-h-full overflow-y-auto pr-1">
              {threads.length === 0 ? (
                <p className="text-zinc-500 text-sm p-4">No chats yet.</p>
              ) : (
                threads.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setActiveThreadId(t.id); loadMsgs(t.id); }}
                    className={`w-full text-left p-3 rounded-2xl border-2 transition-all ${
                      activeThreadId === t.id
                        ? 'border-fuchsia-400/60 bg-fuchsia-500/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm truncate">{t.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        t.status === 'open' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-500/15 text-zinc-400'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 truncate mt-1">{t.email}</div>
                    <div className="text-xs text-zinc-400 truncate mt-1">{t.preview || '—'}</div>
                  </button>
                ))
              )}
            </div>
            <div className="bg-[#170b28]/80 border-2 border-white/10 rounded-3xl p-4 flex flex-col h-full min-h-[60vh]">
              {!activeThreadId ? (
                <p className="text-zinc-500 text-sm m-auto">Pick a chat. 👈</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-bold">{threads.find((t) => t.id === activeThreadId)?.name}</div>
                      <div className="text-xs text-zinc-500">{threads.find((t) => t.id === activeThreadId)?.email}</div>
                    </div>
                    <button onClick={closeThread} className="text-xs font-bold text-zinc-400 hover:text-white underline">
                      Close chat
                    </button>
                  </div>
                  <div ref={containerRef} className="flex-1 space-y-2 overflow-y-auto pr-1 mb-4 max-h-[44vh]">
                    {adminMsgs.length === 0 ? (
                      <p className="text-zinc-500 text-sm p-4">No messages yet.</p>
                    ) : (
                      <>
                        {renderBubbles(adminMsgs)}
                        {unreadCount > 0 && !atBottom && (
                          <button
                            onClick={jumpToBottom}
                            className="mx-auto mt-2 text-xs font-bold text-indigo-300 hover:text-white underline"
                          >
                            Jump to bottom ({unreadCount} new)
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <form onSubmit={sendReply} className="flex gap-2">
                    <input
                      value={adminDraft}
                      onChange={(e) => setAdminDraft(e.target.value)}
                      placeholder="Reply…"
                      maxLength={3000}
                      className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-fuchsia-400/60"
                    />
                    <button
                      type="submit"
                      disabled={!adminDraft.trim()}
                      className="px-5 py-3 bg-white text-zinc-950 font-extrabold rounded-xl text-sm disabled:opacity-60"
                    >
                      Send
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // USER MODE — personal support chat
  // =========================================================================
  const [thread, setThread] = useState<SupportThread | null>(() => loadThread());
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [status, setStatus] = useState<string>('open');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [starting, setStarting] = useState(false);

  const poll = useCallback(async () => {
    if (!thread) return;
    try {
      const data = await api.supportChat(authToken, {
        action: 'poll',
        threadId: thread.threadId,
        secret: thread.secret,
      });
      const incoming = normalizeMessages(data.messages ?? []);
      setMessages((prev) => {
        const prevById = new Map(prev.map((m) => [m.id, m]));
        const merged: ChatBubble[] = [];
        const seen = new Set<string>();
        for (const m of incoming) { merged.push(m); seen.add(m.id); }
        for (const m of prev) { if (!seen.has(m.id)) merged.push(m); }
        return merged;
      });
      setStatus(String(data.status ?? 'open'));
    } catch {
      // Keep last good messages; polling is best-effort.
    }
  }, [thread, authToken]);

  useEffect(() => {
    if (!thread) return;
    setLoading(true);
    poll().finally(() => setLoading(false));
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [thread, poll]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !firstMessage.trim()) {
      toast.error('Please add your name and a message.');
      return;
    }
    setStarting(true);
    try {
      const data = await api.supportChat(authToken, {
        action: 'start',
        name: name.trim(),
        email: email.trim(),
        message: firstMessage.trim(),
        content: firstMessage.trim(),
      });
      const threadId = String(data.threadId ?? data.thread_id ?? data.id ?? '');
      const secret = String(data.secret ?? data.token ?? '');
      if (!threadId || !secret) throw new Error('Could not start chat.');
      const t = { threadId, secret };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
      setThread(t);
      const initial = (data.messages ?? []) as unknown;
      if (Array.isArray(initial) && initial.length > 0) setMessages(normalizeMessages(initial));
      else setMessages([{ id: 'local-0', mine: true, text: firstMessage.trim(), at: '' }]);
      setStatus(String(data.status ?? 'open'));
      toast.success('Chat started — we\'ll reply here.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start chat.');
    } finally {
      setStarting(false);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !thread || sending) return;
    if (status === 'closed') return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      await api.supportChat(authToken, {
        action: 'send',
        threadId: thread.threadId,
        secret: thread.secret,
        message: text,
        content: text,
      });
      setMessages((m) => [...m, { id: `local-${Date.now()}`, mine: true, text, at: '' }]);
      await poll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setThread(null);
    setMessages([]);
    setStatus('open');
    setInput('');
  };

  const closed = status.toLowerCase() === 'closed';

  if (!thread) {
    return (
      <div className="max-w-2xl mx-auto pb-28 animate-fade-in">
        <h1 className="text-4xl font-black mb-2 flex items-center gap-3">
          <LifeBuoy size={32} className="text-indigo-400" /> Support
        </h1>
        <p className="text-zinc-400 text-sm mb-8">Chat with the team — no login required. Replies appear here live; leave an email for replies if you go.</p>
        <Card className="p-6">
          <form onSubmit={start} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={64}
                  className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Email (optional)</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  maxLength={128}
                  className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Message</label>
              <textarea
                value={firstMessage}
                onChange={(e) => setFirstMessage(e.target.value)}
                placeholder="How can we help?"
                rows={4}
                maxLength={2000}
                className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 resize-y"
              />
            </div>
            <button
              type="submit"
              disabled={starting}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-bold flex items-center justify-center gap-2"
            >
              <Send size={16} /> {starting ? 'Starting…' : 'Start chat'}
            </button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-28 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-black flex items-center gap-3">
          <LifeBuoy size={28} className="text-indigo-400" /> Support chat
        </h1>
        <button
          onClick={reset}
          title="Start a new chat"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-bold text-zinc-300"
        >
          <RotateCcw size={14} /> New chat
        </button>
      </div>
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${closed ? 'bg-zinc-500' : 'bg-emerald-400'}`} />
            {closed ? 'Closed' : 'Open'}
          </span>
          <span className="normal-case font-semibold">Replies refresh every few seconds</span>
        </div>
        <div ref={containerRef} className="h-[50vh] overflow-y-auto p-5 space-y-3 bg-black/20">
          {loading && messages.length === 0 ? (
            <Spinner label="Loading messages…" />
          ) : (
            <>
              {renderBubbles(messages)}
              {unreadCount > 0 && !atBottom && (
                <button
                  onClick={jumpToBottom}
                  className="mx-auto mt-2 text-xs font-bold text-indigo-300 hover:text-white underline"
                >
                  Jump to bottom ({unreadCount} new)
                </button>
              )}
            </>
          )}
        </div>
        {closed ? (
          <div className="p-5 border-t border-white/5 text-center text-sm text-zinc-400">
            This chat is closed. Start a <button onClick={reset} className="text-indigo-300 font-bold hover:underline">new chat</button> if you need more help.
          </div>
        ) : (
          <form onSubmit={send} className="p-4 border-t border-white/5 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your reply…"
              maxLength={2000}
              className="flex-1 bg-black/50 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-indigo-500"
            />
            <button
              disabled={!input.trim() || sending}
              className="px-6 rounded-2xl bg-indigo-600 font-bold disabled:opacity-50 flex items-center gap-2"
            >
              <Send size={15} /> Send
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
