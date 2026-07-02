import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import io, { Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

const API_BASE = 'https://dj-scratch.vercel.app';
const SOCKET_URL = 'http://localhost:3001';

export default function MessagesClient({ token, user }: { token: string | null, user: any }) {
  const [friends, setFriends] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!token || !user) return;

    const newSocket = io(SOCKET_URL);
    newSocket.on('connect', () => {
      newSocket.emit('authenticate', user.id);
    });

    newSocket.on('receive_message', (data) => {
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, data];
      });
    });

    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, [token, user]);

  useEffect(() => {
    const fetchFriends = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/api/friends`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.friends) {
          setFriends(data.friends.filter((f: any) => f.status === 'accepted'));
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchFriends();
  }, [token]);

  useEffect(() => {
    if (!activeChat || !token) return;

    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/messages/${activeChat.friend_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.messages) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchHistory();
  }, [activeChat, token]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeChat || !token) return;

    const content = input.trim();
    setInput('');

    try {
      const res = await fetch(`${API_BASE}/api/messages/${activeChat.friend_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      });
      const data = await res.json();

      if (data.success && socket) {
        const msg = data.message;
        setMessages(prev => [...prev, msg]);
        socket.emit('new_message', msg);
      } else {
        toast.error('Failed to send message');
      }
    } catch (err) {
      toast.error('Failed to send message');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto h-[80vh] flex bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl animate-fade-in-up">
      {/* Sidebar */}
      <div className="w-80 border-r border-white/5 bg-black/20 flex flex-col">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-2xl font-black tracking-tight">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {friends.length === 0 ? (
            <p className="text-zinc-500 text-center p-4">No friends yet.</p>
          ) : (
            friends.map(f => (
              <button
                key={f.friend_id}
                onClick={() => setActiveChat(f)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 ${
                  activeChat?.friend_id === f.friend_id 
                    ? 'bg-indigo-500/20 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                    : 'hover:bg-white/5 border border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-xl text-white shadow-lg shrink-0">
                  {(f.display_name || f.friend_username).charAt(0).toUpperCase()}
                </div>
                <div className="text-left overflow-hidden">
                  <p className="font-bold text-lg truncate text-white">{f.display_name || f.friend_username}</p>
                  <p className="text-xs truncate text-zinc-500">@{f.friend_username}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col relative bg-zinc-950/40">
        {activeChat ? (
          <>
            <div className="p-6 border-b border-white/5 bg-black/20 flex items-center gap-4 backdrop-blur-md sticky top-0 z-10 shadow-lg">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-xl shadow-lg">
                {(activeChat.display_name || activeChat.friend_username).charAt(0).toUpperCase()}
              </div>
              <h3 className="font-black text-2xl">{activeChat.display_name || activeChat.friend_username}</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map(m => {
                const isMe = m.sender_id === user.id;
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-5 py-3 rounded-2xl shadow-lg ${
                      isMe 
                        ? 'bg-indigo-600 text-white rounded-br-sm shadow-indigo-600/20' 
                        : 'bg-zinc-800 text-zinc-200 rounded-bl-sm border border-white/5'
                    }`}>
                      <p className="text-md leading-relaxed break-words">{m.content}</p>
                      <p className={`text-[10px] mt-2 font-bold ${isMe ? 'text-indigo-200' : 'text-zinc-500'}`}>
                        {new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-6 bg-black/40 border-t border-white/5 backdrop-blur-md">
              <form onSubmit={sendMessage} className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={`Message @${activeChat.friend_username}...`}
                  className="flex-1 bg-black/50 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner text-lg"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-8 py-4 rounded-2xl font-black transition-all hover:scale-105 shadow-[0_0_20px_rgba(79,70,229,0.3)] flex items-center justify-center"
                >
                  <Send className="w-6 h-6" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
            <MessageSquare className="w-24 h-24 mb-6 opacity-20" />
            <p className="text-2xl font-bold opacity-50 tracking-tight">Select a friend to chat</p>
          </div>
        )}
      </div>
    </div>
  );
}
