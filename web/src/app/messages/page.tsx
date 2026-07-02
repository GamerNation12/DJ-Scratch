"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import io, { Socket } from "socket.io-client";
import { Send, User, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";

// Replace with your actual deployed socket server URL in production
const SOCKET_URL = "http://localhost:3001";

function MessagesContent() {
  const searchParams = useSearchParams();
  const initialUser = searchParams.get("u");
  
  const [friends, setFriends] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const token = localStorage.getItem("discord_jwt");
    if (!token) {
      window.location.href = "/api/auth/login";
      return;
    }

    try {
      const base64Str = token.split('.')[1].replace(/-/g, "+").replace(/_/g, "/");
      const decoded = JSON.parse(atob(base64Str));
      setMyId(decoded.id);
      
      const newSocket = io(SOCKET_URL);
      newSocket.on("connect", () => {
        newSocket.emit("authenticate", decoded.id);
      });
      
      newSocket.on("receive_message", (data) => {
        setMessages(prev => {
          // Prevent duplicates if we already added it optimistically
          if (prev.some(m => m.id === data.id)) return prev;
          return [...prev, data];
        });
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const fetchFriends = async () => {
      const token = localStorage.getItem("discord_jwt");
      try {
        const res = await fetch("/api/friends", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.friends) {
          const accepted = data.friends.filter((f: any) => f.status === 'accepted');
          setFriends(accepted);
          
          if (initialUser) {
            const target = accepted.find((f: any) => f.friend_id === initialUser);
            if (target) {
              setActiveChat(target);
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchFriends();
  }, [initialUser]);

  useEffect(() => {
    if (!activeChat) return;
    
    const fetchHistory = async () => {
      const token = localStorage.getItem("discord_jwt");
      try {
        const res = await fetch(`/api/messages/${activeChat.friend_id}`, {
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
  }, [activeChat]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeChat) return;

    const content = input.trim();
    setInput("");

    const token = localStorage.getItem("discord_jwt");
    try {
      const res = await fetch(`/api/messages/${activeChat.friend_id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content })
      });
      const data = await res.json();
      
      if (data.success && socket) {
        const msg = data.message;
        setMessages(prev => [...prev, msg]);
        socket.emit("new_message", msg);
      } else {
        toast.error("Failed to send message");
      }
    } catch (err) {
      toast.error("Failed to send message");
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white pt-20 px-4 sm:px-6 lg:px-8 pb-10">
      <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl animate-fade-in-up">
        
        {/* Sidebar */}
        <div className="w-1/3 border-r border-white/5 flex flex-col bg-black/20">
          <div className="p-4 border-b border-white/5">
            <h2 className="font-semibold text-lg">Direct Messages</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {friends.length === 0 ? (
              <p className="text-zinc-500 text-sm p-4 text-center">No friends yet. Add some to start chatting!</p>
            ) : (
              friends.map(f => (
                <button
                  key={f.friend_id}
                  onClick={() => setActiveChat(f)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    activeChat?.friend_id === f.friend_id 
                      ? "bg-indigo-500/20 text-white" 
                      : "hover:bg-white/5 text-zinc-300"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
                    <span className="font-bold text-white">{(f.display_name || f.friend_username).charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="text-left overflow-hidden">
                    <p className="font-medium truncate">{f.display_name || f.friend_username}</p>
                    <p className="text-xs text-zinc-500 truncate">@{f.friend_username}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="w-2/3 flex flex-col relative">
          {activeChat ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-white/5 bg-black/20 flex items-center gap-3 backdrop-blur-md absolute top-0 w-full z-10">
                 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                    <span className="font-bold text-white">{(activeChat.display_name || activeChat.friend_username).charAt(0).toUpperCase()}</span>
                  </div>
                <div>
                  <h3 className="font-semibold">{activeChat.display_name || activeChat.friend_username}</h3>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 pt-20 pb-20 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                    <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
                    <p>No messages yet. Say hi!</p>
                  </div>
                ) : (
                  messages.map(m => {
                    const isMe = m.sender_id === myId;
                    return (
                      <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                          isMe 
                            ? 'bg-indigo-600 text-white rounded-br-sm shadow-lg shadow-indigo-600/20' 
                            : 'bg-zinc-800 text-zinc-200 rounded-bl-sm border border-white/5'
                        }`}>
                          <p className="break-words">{m.content}</p>
                          <p className={`text-[10px] mt-1 ${isMe ? 'text-indigo-200' : 'text-zinc-500'}`}>
                            {new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 bg-black/40 border-t border-white/5 absolute bottom-0 w-full backdrop-blur-md">
                <form onSubmit={sendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={`Message @${activeChat.friend_username}...`}
                    className="flex-1 bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
              <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">Select a friend to start chatting</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#030712] flex items-center justify-center text-white">Loading...</div>}>
      <MessagesContent />
    </Suspense>
  );
}
