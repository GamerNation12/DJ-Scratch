import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';
import type { ChatMessage, Friend, JwtUser } from '../lib/types';
import { Spinner } from '../components/ui';

export default function MessagesPage({ token, user }: { token: string | null; user: JwtUser }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [active, setActive] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        const data = await api.getFriends(token);
        setFriends(((data.friends || []) as Friend[]).filter((f) => f.status === 'accepted'));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!active || !token) return;
    let stop = false;
    const load = async () => {
      try {
        const data = await api.getMessages(token, active.friend_id);
        if (!stop) setMessages((data.messages || []) as ChatMessage[]);
      } catch {}
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [active, token]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !active || !token) return;
    const content = input.trim();
    setInput('');
    try {
      const res = await api.sendMessage(token, active.friend_id, content);
      if (res.success && res.message) setMessages((m) => [...m, res.message as ChatMessage]);
      else {
        const data = await api.getMessages(token, active.friend_id);
        setMessages((data.messages || []) as ChatMessage[]);
      }
    } catch {
      toast.error('Failed to send');
    }
  };

  if (loading) return <Spinner label="Loading chats…" />;

  return (
    <div className="w-full max-w-5xl mx-auto h-[76vh] flex bg-zinc-900/50 border border-white/10 rounded-[1.5rem] overflow-hidden animate-fade-in">
      <div className="w-72 border-r border-white/5 bg-black/20 flex flex-col">
        <div className="p-5 border-b border-white/5 font-black text-xl">Messages</div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {friends.map((f) => (
            <button
              key={f.friend_id}
              onClick={() => setActive(f)}
              className={`w-full text-left p-3 rounded-2xl ${active?.friend_id === f.friend_id ? 'bg-indigo-500/20 border border-indigo-500/30' : 'hover:bg-white/5 border border-transparent'}`}
            >
              <div className="font-bold truncate">{f.display_name || f.friend_username}</div>
              <div className="text-xs text-zinc-500 truncate">@{f.friend_username}</div>
            </button>
          ))}
          {friends.length === 0 && <p className="text-zinc-500 text-sm p-4">No friends yet.</p>}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500 font-bold">Select a friend to chat</div>
        ) : (
          <>
            <div className="p-5 border-b border-white/5 font-black">{active.display_name || active.friend_username}</div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.map((m) => {
                const mine = String(m.sender_id) === String(user.id);
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${mine ? 'bg-indigo-600' : 'bg-zinc-800 border border-white/5'}`}>
                      <p className="break-words">{m.content}</p>
                      <p className="text-[10px] mt-1 opacity-60">{new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <form onSubmit={send} className="p-4 border-t border-white/5 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Message @${active.friend_username}…`}
                className="flex-1 bg-black/50 border border-white/10 rounded-2xl px-5 py-3 focus:outline-none focus:border-indigo-500"
              />
              <button disabled={!input.trim()} className="px-6 rounded-2xl bg-indigo-600 font-bold disabled:opacity-50">Send</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
