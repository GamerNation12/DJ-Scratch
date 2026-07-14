"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import io, { Socket } from "socket.io-client";
import { Send, User, MessageSquare, AlertCircle, Trash2, RefreshCw, Smile, Menu, X, Paperclip, Image, Film, File } from "lucide-react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://mango.fps.ms:20544";
const STANDARD_EMOJIS = ["😀", "😂", "🤣", "😊", "😍", "🥰", "😘", "😋", "😎", "😭", "🥺", "😡", "👍", "👎", "🙏", "👏", "🔥", "💯", "✨", "💀", "👀", "🤡", "👽", "❤️", "💔", "⭐", "🎉", "✅", "❌"];

export default function ActivityDMUI() {
  const searchParams = useSearchParams();
  const initialUser = searchParams.get("u");
  
  const [friends, setFriends] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [customEmojis, setCustomEmojis] = useState<any[]>([]);
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<number | null>(null);
  const [showChatEmojiPicker, setShowChatEmojiPicker] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifs, setGifs] = useState<any[]>([]);
  const [gifSearch, setGifSearch] = useState("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  // Friend Management States
  const [pendingFriends, setPendingFriends] = useState({ incoming: [] as any[], outgoing: [] as any[] });
  const [friendInput, setFriendInput] = useState("");
  const [friendReqStatus, setFriendReqStatus] = useState({ type: '', msg: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const token = localStorage.getItem("discord_jwt");
    if (!token) return;

    try {
      const base64Str = token.split('.')[1].replace(/-/g, "+").replace(/_/g, "/");
      const decoded = JSON.parse(atob(base64Str));
      setMyId(decoded.id);
      setCurrentUser(decoded);
      
      let newSocket: Socket | null = null;
    
      if (activeChat && SOCKET_URL) {
        const socket = io(SOCKET_URL);
        socket.on("connect", () => {
          socket.emit("authenticate", decoded.id);
        });
        
        socket.on("receive_message", (data) => {
          setMessages(prev => {
            if (prev.some(m => m.id === data.id)) return prev;
            return [...prev, data];
          });
        });
        
        socket.on("new_reaction", (data) => {
          setMessages(prev => prev.map(m => {
            if (m.id === data.messageId) {
              const updatedReactions = m.reactions ? [...m.reactions, data.emoji] : [data.emoji];
              return { ...m, reactions: updatedReactions };
            }
            return m;
          }));
        });
        
        socket.on("typing_start", () => {
          setIsTyping(true);
        });
        
        socket.on("typing_stop", () => {
          setIsTyping(false);
        });
        
        socket.on("messages_read", () => {
          setMessages(prev => prev.map(m => (!m.read_at ? { ...m, read_at: new Date().toISOString() } : m)));
        });
        
        setSocket(socket);
        newSocket = socket;
      }
      
      return () => {
        newSocket?.disconnect();
      };
    } catch (e) {
      console.error(e);
    }
  }, [activeChat]);

  useEffect(() => {
    const fetchFriends = async () => {
      const token = localStorage.getItem("discord_jwt");
      if (!token) return;
      
      try {
        const res = await fetch("/api/friends", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.friends) {
          const accepted = data.friends.filter((f: any) => f.status === 'accepted');
          const pIncoming = data.friends.filter((f: any) => f.status === 'pending' && f.direction === 'incoming');
          const pOutgoing = data.friends.filter((f: any) => f.status === 'pending' && f.direction === 'outgoing');
          
          setPendingFriends({ incoming: pIncoming, outgoing: pOutgoing });
          
          const botFriend = {
            friend_id: "BOT",
            friend_username: "djscratch",
            display_name: "DJ Scratch Bot",
            status: "accepted",
            direction: "outgoing",
            avatar_url: "/logo.png"
          };
          
          const allFriends = [botFriend, ...accepted];
          setFriends(allFriends);
          
          if (initialUser) {
            const target = allFriends.find((f: any) => f.friend_id === initialUser);
            if (target) {
              setActiveChat(target);
            }
          } else if (allFriends.length > 0 && !activeChat && activeChat !== 'add_friend') {
            setActiveChat(allFriends[0]);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    
    const fetchEmojis = async () => {
      const token = localStorage.getItem("discord_jwt");
      if (!token) return;
      try {
        const res = await fetch("/api/emojis", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.emojis) setCustomEmojis(data.emojis);
      } catch(e) {}
    };

    fetchFriends();
    fetchEmojis();
  }, [initialUser]);

  useEffect(() => {
    if (!activeChat) return;
    
    const fetchHistory = async () => {
      const token = localStorage.getItem("discord_jwt");
      if (!token) return;
      
      try {
        const res = await fetch(`/api/messages/${activeChat.friend_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.messages) {
          const failedKey = `failed_msgs_${activeChat.friend_id}`;
          const savedFailed = localStorage.getItem(failedKey);
          let failedMsgs: any[] = [];
          if (savedFailed) {
            try { failedMsgs = JSON.parse(savedFailed); } catch(e) {}
          }
          
          setMessages(prev => {
            const sendingMsgs = prev.filter(m => m.isSending);
            return [...data.messages, ...failedMsgs, ...sendingMsgs];
          });
          
          const hasUnread = data.messages.some((m: any) => m.sender_id === activeChat.friend_id && !m.read_at);
          if (hasUnread) {
            fetch(`/api/messages/${activeChat.friend_id}`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${token}` }
            }).catch(console.error);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    
    fetchHistory();
    const interval = setInterval(fetchHistory, 3000);
    return () => clearInterval(interval);
  }, [activeChat]);

  const removeFailedMessage = (id: any, friendId: string) => {
    const failedKey = `failed_msgs_${friendId}`;
    const saved = localStorage.getItem(failedKey);
    if (saved) {
      try {
        let failedMsgs = JSON.parse(saved);
        failedMsgs = failedMsgs.filter((m: any) => m.id !== id);
        localStorage.setItem(failedKey, JSON.stringify(failedMsgs));
      } catch(e) {}
    }
  };

  const saveFailedMessage = (msg: any, friendId: string) => {
    const failedKey = `failed_msgs_${friendId}`;
    const saved = localStorage.getItem(failedKey);
    let failedMsgs: any[] = [];
    if (saved) {
      try { failedMsgs = JSON.parse(saved); } catch(e) {}
    }
    failedMsgs.push(msg);
    localStorage.setItem(failedKey, JSON.stringify(failedMsgs));
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!socket || !activeChat) return;
    
    socket.emit("typing_start", { receiver_id: activeChat.friend_id });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing_stop", { receiver_id: activeChat.friend_id });
    }, 2000);
  };

  const searchGifs = async (query: string) => {
    setGifSearch(query);
    if (!query) {
      setGifs([]);
      return;
    }
    try {
      // Using Giphy's public beta API key
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${query}&limit=20`);
      const data = await res.json();
      if (data.data) {
        setGifs(data.data.map((gif: any) => ({
          url: gif.images.original.url,
          preview_url: gif.images.fixed_height.url
        })));
      }
    } catch (e) {}
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const token = localStorage.getItem("discord_jwt");
      // Use our server-side proxy to upload to external host, bypassing CORS
      const res = await fetch('/api/external-upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      
      if (data.success && data.url) {
        const fileUrl = data.url;
        // Send the file as a markdown message
        const isImage = file.type.startsWith('image/');
        const msgContent = isImage ? `![${file.name}](${fileUrl})` : `[📎 ${file.name}](${fileUrl})`;
        await sendMessage(undefined, msgContent);
      } else {
        toast.error("Failed to upload file");
      }
    } catch (err) {
      toast.error("Error uploading file");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendMessage = async (e?: React.FormEvent, retryContent?: string, retryId?: any) => {
    if (e) e.preventDefault();
    const content = retryContent || input.trim();
    if (!content || !activeChat) return;

    if (!retryContent) setInput("");

    if (retryId) {
      setMessages(prev => prev.filter(m => m.id !== retryId));
      removeFailedMessage(retryId, activeChat.friend_id);
    }

    const tempId = `temp-${Date.now()}`;
    const token = localStorage.getItem("discord_jwt");
    
    const optimisticMsg = {
      id: tempId,
      sender_id: myId,
      receiver_id: activeChat.friend_id,
      content,
      sent_at: new Date().toISOString(),
      isSending: true,
      failed: false
    };
    
    setMessages(prev => [...prev, optimisticMsg]);

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
      
      if (data.success) {
        const msg = data.message;
        setMessages(prev => prev.map(m => m.id === tempId ? msg : m));
        if (socket) {
          socket.emit("new_message", msg);
        }
      } else {
        const failedMsg = { ...optimisticMsg, isSending: false, failed: true };
        setMessages(prev => prev.map(m => m.id === tempId ? failedMsg : m));
        saveFailedMessage(failedMsg, activeChat.friend_id);
      }
    } catch (err) {
      const failedMsg = { ...optimisticMsg, isSending: false, failed: true };
      setMessages(prev => prev.map(m => m.id === tempId ? failedMsg : m));
      saveFailedMessage(failedMsg, activeChat.friend_id);
    }
  };

  const deleteFailedMessage = (id: any) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    if (activeChat) removeFailedMessage(id, activeChat.friend_id);
  };

  const handleReact = async (messageId: number, emoji: any) => {
    setShowEmojiPickerFor(null);
    const token = localStorage.getItem("discord_jwt");
    try {
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          const updatedReactions = m.reactions ? [...m.reactions, emoji] : [emoji];
          return { ...m, reactions: updatedReactions };
        }
        return m;
      }));

      await fetch(`/api/messages/${activeChat.friend_id}/react`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ messageId, emoji })
      });
    } catch(err) {}
  };

  const sendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendInput.trim()) return;
    setFriendReqStatus({ type: 'loading', msg: 'Sending request...' });
    const token = localStorage.getItem("discord_jwt");
    
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: friendInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setFriendReqStatus({ type: 'success', msg: data.message || 'Friend request sent!' });
        setFriendInput("");
        // trigger a refetch of friends by changing some state or just let the user see it next time, but for now we can just leave it as success
      } else {
        setFriendReqStatus({ type: 'error', msg: data.error || 'Failed to send request.' });
      }
    } catch (err) {
      setFriendReqStatus({ type: 'error', msg: 'Failed to send request.' });
    }
  };

  const handleFriendAction = async (friendId: string, action: 'accept' | 'reject') => {
    const token = localStorage.getItem("discord_jwt");
    try {
      const res = await fetch("/api/friends", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ friendId, action })
      });
      if (res.ok) {
        setPendingFriends(prev => ({
          ...prev,
          incoming: prev.incoming.filter(f => f.friend_id !== friendId)
        }));
      }
    } catch (err) {}
  };

  const renderMessageContent = (content: string) => {
    const regex = /<a?:([^:]+):(\d+)>/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`md-${lastIndex}`} className="inline [&>p]:inline [&_a]:text-indigo-400 hover:[&_a]:underline [&_strong]:font-bold [&_em]:italic break-words text-[15px]">
            <ReactMarkdown components={{
              img: ({node, ...props}) => <img {...props} className="max-w-xs max-h-64 rounded-xl object-contain mt-2 border border-white/10 shadow-lg" />,
              a: ({node, ...props}) => <a {...props} className="text-indigo-400 hover:underline break-all" target="_blank" rel="noopener noreferrer" />
            }}>{content.substring(lastIndex, match.index)}</ReactMarkdown>
          </span>
        );
      }
      const isAnimated = match[0].startsWith('<a:');
      const emojiName = match[1];
      const emojiId = match[2];
      const ext = isAnimated ? 'gif' : 'png';
      
      parts.push(
        <img 
          key={`emoji-${match.index}`} 
          src={`https://cdn.discordapp.com/emojis/${emojiId}.${ext}?size=48`} 
          alt={emojiName} 
          title={emojiName}
          className="inline-block w-7 h-7 object-contain align-middle mx-0.5 pointer-events-none select-none drop-shadow-md" 
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      );
      
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < content.length) {
      parts.push(
        <span key={`md-${lastIndex}`} className="inline [&>p]:inline [&_a]:text-indigo-400 hover:[&_a]:underline [&_strong]:font-bold [&_em]:italic break-words text-[15px]">
          <ReactMarkdown components={{
            img: ({node, ...props}) => (
              <span className="block mt-2">
                <img {...props} className="max-w-xs max-h-64 rounded-xl object-contain border border-white/10 shadow-lg inline-block" />
              </span>
            ),
            a: ({node, ...props}) => <a {...props} className="text-indigo-400 hover:underline break-all" target="_blank" rel="noopener noreferrer" />
          }}>{content.substring(lastIndex)}</ReactMarkdown>
        </span>
      );
    }
    
    return parts.length > 0 ? parts : content;
  };

  const getAvatar = (user: any) => {
    if (user?.avatar_url) return user.avatar_url;
    return `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`;
  };

  return (
    <div className="w-screen h-screen flex overflow-hidden bg-[#09090b] text-zinc-200 font-sans selection:bg-indigo-500/30 selection:text-white pt-14 md:pt-0">
      
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute bottom-0 right-1/4 w-1/2 h-1/2 bg-purple-500/10 blur-[120px] rounded-full pointer-events-none z-0"></div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Sidebar - Friends List */}
      <div className={`
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 transition-transform absolute md:relative z-50
        w-[280px] h-full bg-zinc-950/80 backdrop-blur-2xl border-r border-white/5 flex flex-col flex-shrink-0 shadow-2xl
      `}>
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-6 z-10 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-2 group">
            <img src="/logo.png" alt="DJ Scratch" className="w-8 h-8 rounded-xl shadow-lg shadow-black/50 group-hover:scale-105 transition-transform" />
            <span className="font-bold text-lg bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">DJ Scratch</span>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto pt-4 px-3 custom-scrollbar">
          <div className="mb-4">
            <button
              onClick={() => {
                setActiveChat('add_friend');
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition-all group relative overflow-hidden font-bold ${
                activeChat === 'add_friend' 
                  ? "bg-green-500/20 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.15)] border border-green-500/30" 
                  : "bg-white/5 hover:bg-green-500/10 text-zinc-300 hover:text-green-400 border border-white/5 hover:border-green-500/20"
              }`}
            >
              <User className="w-5 h-5" />
              Friends
              {pendingFriends.incoming.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1 animate-pulse">
                  {pendingFriends.incoming.length}
                </span>
              )}
            </button>
          </div>

          <h2 className="px-3 py-1 text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
            Direct Messages
          </h2>
          
          {friends.length === 0 ? (
            <p className="text-zinc-500 text-sm p-4 text-center bg-white/5 rounded-xl border border-white/5 mt-2">No friends yet.</p>
          ) : (
            <div className="space-y-1">
              {friends.map(f => {
                const isActive = activeChat?.friend_id === f.friend_id;
                const name = f.display_name || f.friend_username;
                return (
                  <button
                    key={f.friend_id}
                    onClick={() => {
                      setActiveChat(f);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative overflow-hidden ${
                      isActive ? "bg-white/10 text-white shadow-lg shadow-black/20 border border-white/10" : "hover:bg-white/5 text-zinc-400 border border-transparent"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.8)]"></div>
                    )}
                    <div className="relative">
                      <img src={getAvatar(f)} className={`w-10 h-10 rounded-full bg-zinc-900 border border-white/10 transition-transform ${isActive ? 'scale-105' : 'group-hover:scale-105'}`} alt="" />
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-zinc-950 rounded-full shadow-sm"></div>
                    </div>
                    <div className="flex flex-col items-start overflow-hidden">
                      <span className={`font-semibold text-sm truncate w-full text-left ${isActive ? 'text-white' : 'group-hover:text-zinc-200'}`}>
                        {name}
                      </span>
                      <span className="text-xs text-zinc-500 truncate w-full text-left">
                        @{f.friend_username}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* User Profile Bar */}
        <div className="p-4 border-t border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3 bg-white/5 rounded-xl p-2.5 border border-white/5 hover:bg-white/10 cursor-pointer transition-colors">
            {currentUser?.image ? (
              <img src={currentUser.image} alt={currentUser.discord_name || "You"} className="w-9 h-9 rounded-full shadow-lg shadow-indigo-500/20 object-cover flex-shrink-0 border border-white/10" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
                <span className="font-bold text-white text-sm">ME</span>
              </div>
            )}
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-bold text-white leading-tight truncate">
                {currentUser?.discord_name || currentUser?.name || "You"}
              </span>
              <span className="text-xs text-indigo-300 leading-tight truncate">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 z-10 relative">
        
        {activeChat === 'add_friend' ? (
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-zinc-950/50 backdrop-blur-sm">
            <div className="h-16 border-b border-white/5 flex items-center px-6 z-10 flex-shrink-0 bg-zinc-950/30 backdrop-blur-md">
              <button className="md:hidden mr-4 text-zinc-400 hover:text-white p-2 bg-white/5 rounded-lg border border-white/5" onClick={() => setMobileSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 p-[2px] shadow-lg shadow-green-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg leading-tight">Friends</h3>
                  <p className="text-xs text-green-400 leading-tight">Add and manage friends</p>
                </div>
              </div>
            </div>

            <div className="max-w-3xl w-full mx-auto p-6 flex flex-col gap-8">
              
              {/* Add Friend Section */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[50px] rounded-full pointer-events-none"></div>
                <h2 className="text-lg font-bold text-white mb-2">Add Friend</h2>
                <p className="text-sm text-zinc-400 mb-4">You can add friends with their DJ Scratch username.</p>
                <form onSubmit={sendFriendRequest} className="relative flex items-center">
                  <input
                    type="text"
                    value={friendInput}
                    onChange={(e) => setFriendInput(e.target.value)}
                    placeholder="Enter a username..."
                    className="flex-1 bg-zinc-900/80 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all pr-32"
                  />
                  <button
                    type="submit"
                    disabled={!friendInput.trim() || friendReqStatus.type === 'loading'}
                    className="absolute right-1.5 top-1.5 bottom-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white font-bold px-4 rounded-lg transition-colors shadow-lg shadow-indigo-500/20 text-sm"
                  >
                    Send Request
                  </button>
                </form>
                {friendReqStatus.msg && (
                  <div className={`mt-3 text-sm font-medium ${friendReqStatus.type === 'success' ? 'text-green-400' : friendReqStatus.type === 'error' ? 'text-red-400' : 'text-zinc-400'}`}>
                    {friendReqStatus.msg}
                  </div>
                )}
              </div>

              {/* Pending Requests */}
              {(pendingFriends.incoming.length > 0 || pendingFriends.outgoing.length > 0) && (
                <div className="flex flex-col gap-6">
                  
                  {pendingFriends.incoming.length > 0 && (
                    <div>
                      <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-3">Incoming Requests ({pendingFriends.incoming.length})</h2>
                      <div className="grid gap-3">
                        {pendingFriends.incoming.map((f: any) => (
                          <div key={f.friend_id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-3">
                              <img src={getAvatar(f)} className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10" alt="" />
                              <div className="flex flex-col">
                                <span className="font-bold text-white text-sm">{f.display_name || f.friend_username}</span>
                                <span className="text-xs text-zinc-400">@{f.friend_username}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleFriendAction(f.friend_id, 'accept')} className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 p-2 rounded-lg transition-colors" title="Accept">
                                <User className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleFriendAction(f.friend_id, 'reject')} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 p-2 rounded-lg transition-colors" title="Reject">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pendingFriends.outgoing.length > 0 && (
                    <div>
                      <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-3">Outgoing Requests ({pendingFriends.outgoing.length})</h2>
                      <div className="grid gap-3">
                        {pendingFriends.outgoing.map((f: any) => (
                          <div key={f.friend_id} className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl p-3 opacity-60">
                            <div className="flex items-center gap-3">
                              <img src={getAvatar(f)} className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10" alt="" />
                              <div className="flex flex-col">
                                <span className="font-bold text-white text-sm">{f.display_name || f.friend_username}</span>
                                <span className="text-xs text-zinc-400">@{f.friend_username}</span>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-zinc-500 uppercase px-2">Pending</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        ) : activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-white/5 flex items-center px-6 z-10 flex-shrink-0 bg-zinc-950/30 backdrop-blur-md">
              <button className="md:hidden mr-4 text-zinc-400 hover:text-white p-2 bg-white/5 rounded-lg border border-white/5" onClick={() => setMobileSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px] shadow-lg shadow-indigo-500/20">
                  <img src={getAvatar(activeChat)} className="w-full h-full rounded-full border-2 border-zinc-950 object-cover" alt="" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg leading-tight">{activeChat.display_name || activeChat.friend_username}</h3>
                  <p className="text-xs text-zinc-400 leading-tight">@{activeChat.friend_username}</p>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar relative">
              {messages.length === 0 ? (
                <div className="flex flex-col justify-end min-h-full pb-8">
                  <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-full flex items-center justify-center mb-6 border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.15)]">
                    <User className="w-12 h-12 text-indigo-400" />
                  </div>
                  <h1 className="text-4xl font-black text-white mb-3 tracking-tight">
                    {activeChat.display_name || activeChat.friend_username}
                  </h1>
                  <p className="text-lg text-zinc-400 max-w-md">
                    This is the beginning of your legendary conversation with <strong className="text-zinc-200">@{activeChat.friend_username}</strong>. Drop a beat!
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((m, index) => {
                    const isMe = m.sender_id === myId && !m.is_bot;
                    
                    return (
                      <div 
                        key={m.id} 
                        className={`group flex flex-col relative ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        {m.is_bot && (
                          <div className="flex items-center gap-1.5 mb-1.5 ml-2">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                              <span className="text-[10px]">🤖</span>
                            </div>
                            <span className="text-xs font-bold text-zinc-300">DJ Scratch</span>
                            <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wider font-bold shadow-sm">Bot</span>
                          </div>
                        )}

                        <div className={`flex ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 max-w-[85%] sm:max-w-[70%]`}>
                          
                          {/* Chat Bubble */}
                          <div className={`px-5 py-3.5 relative group ${
                            isMe 
                              ? m.failed
                                ? 'bg-red-500/10 text-red-200 border border-red-500/30 rounded-2xl rounded-br-sm backdrop-blur-md'
                                : 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-2xl rounded-br-sm shadow-xl shadow-indigo-600/20 border border-indigo-400/20' 
                              : m.is_bot
                                ? 'bg-indigo-950/40 text-zinc-100 rounded-2xl rounded-bl-sm border border-indigo-500/20 shadow-lg backdrop-blur-md ml-8'
                                : 'bg-zinc-800/80 text-zinc-200 rounded-2xl rounded-bl-sm border border-white/5 shadow-lg backdrop-blur-md'
                          } ${m.isSending ? 'opacity-60' : ''}`}>
                            
                            <div className="leading-relaxed drop-shadow-sm">
                              {renderMessageContent(m.content)}
                            </div>

                            {/* Reactions */}
                            {m.reactions && m.reactions.length > 0 && (
                              <div className={`flex flex-wrap gap-1.5 mt-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                {m.reactions.map((r: any, idx: number) => (
                                  <div key={idx} className="bg-black/40 hover:bg-black/60 cursor-pointer px-2 py-1 rounded-lg flex items-center border border-white/10 transition-colors backdrop-blur-md shadow-sm">
                                    <img src={r.url} alt={r.name} className="w-4 h-4 object-contain drop-shadow-md" title={r.name} />
                                    <span className="text-xs font-bold text-zinc-300 ml-1.5 mr-0.5">1</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Time and Status */}
                            <div className={`flex items-center gap-1.5 mt-2 text-[10px] font-medium ${isMe ? m.failed ? 'text-red-300' : 'text-indigo-200/80' : 'text-zinc-500'}`}>
                              {m.failed && <AlertCircle className="w-3 h-3" />}
                              <span>
                                {m.failed ? "Failed to send" : new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isMe && !m.failed && m.read_at && (
                                <span className="ml-1 flex items-center text-indigo-300 font-bold">
                                  ✓ Seen
                                </span>
                              )}
                            </div>

                            {/* Hover Actions */}
                            {!m.isSending && !m.failed && (
                              <div className={`absolute top-1/2 -translate-y-1/2 ${isMe ? '-left-10' : '-right-10'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                                <button 
                                  onClick={() => setShowEmojiPickerFor(showEmojiPickerFor === m.id ? null : m.id)}
                                  className="p-1.5 bg-zinc-800/80 backdrop-blur-md border border-white/10 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-white shadow-lg"
                                >
                                  <Smile className="w-4 h-4" />
                                </button>
                              </div>
                            )}

                            {/* Reaction Picker Popup */}
                            {showEmojiPickerFor === m.id && (
                              <div className={`absolute z-50 top-1/2 -translate-y-1/2 ${isMe ? 'right-[calc(100%+2.5rem)]' : 'left-[calc(100%+2.5rem)]'} w-64 max-h-48 overflow-y-auto bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-xl p-2.5 shadow-2xl flex flex-wrap gap-1.5 custom-scrollbar`}>
                                <div className="w-full flex justify-between items-center mb-1.5 px-1">
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">React</span>
                                  <button onClick={() => setShowEmojiPickerFor(null)} className="text-zinc-500 hover:text-white transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {customEmojis.map((emoji) => (
                                  <button
                                    key={emoji.id}
                                    onClick={() => handleReact(m.id, emoji)}
                                    className="w-10 h-10 rounded-lg flex items-center justify-center p-1.5 hover:bg-white/10 transition-colors"
                                    title={emoji.name}
                                  >
                                    <img src={emoji.url} alt={emoji.name} className="w-full h-full object-contain drop-shadow-md" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {isMe && m.failed && (
                          <div className="flex gap-2 mt-2 mr-2">
                            <button onClick={() => sendMessage(undefined, m.content, m.id)} className="text-xs text-red-400 font-medium hover:text-red-300 flex items-center gap-1 transition-colors bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">
                              <RefreshCw className="w-3 h-3" /> Retry
                            </button>
                            <button onClick={() => deleteFailedMessage(m.id)} className="text-xs text-zinc-400 font-medium hover:text-white flex items-center gap-1 transition-colors bg-zinc-800/50 border border-white/5 px-3 py-1.5 rounded-lg">
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Area */}
            <div className="px-2 sm:px-6 pb-2 sm:pb-6 pt-2 bg-transparent flex-shrink-0 relative z-20">
              {isTyping && (
                <div className="absolute -top-6 left-10 text-xs font-bold text-indigo-400 animate-pulse flex items-center gap-1.5 bg-zinc-900/80 px-3 py-1 rounded-full border border-indigo-500/20 shadow-lg backdrop-blur-md">
                  <span className="flex space-x-1">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                  <span>{activeChat.display_name || activeChat.friend_username} is typing...</span>
                </div>
              )}
              <div className="relative max-w-4xl mx-auto">
                <form 
                  onSubmit={sendMessage} 
                  className="bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl flex items-center p-2 shadow-2xl shadow-black/50 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="flex-shrink-0 p-2 sm:p-3 text-zinc-400 hover:text-indigo-400 hover:bg-white/5 rounded-xl transition-all ml-1 disabled:opacity-50"
                    title="Upload File"
                  >
                    {uploadingFile ? <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : <Paperclip className="w-5 h-5 sm:w-6 sm:h-6 hover:scale-110 transition-transform" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowChatEmojiPicker(!showChatEmojiPicker)}
                    className="flex-shrink-0 p-2 sm:p-3 text-zinc-400 hover:text-indigo-400 hover:bg-white/5 rounded-xl transition-all"
                    title="Select Emoji"
                  >
                    <Smile className="w-5 h-5 sm:w-6 sm:h-6 hover:scale-110 transition-transform" />
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowGifPicker(!showGifPicker); if (!showGifPicker) searchGifs("excited"); }}
                    className="flex-shrink-0 p-2 sm:p-3 text-zinc-400 hover:text-indigo-400 hover:bg-white/5 rounded-xl transition-all"
                    title="Select GIF"
                  >
                    <Film className="w-5 h-5 sm:w-6 sm:h-6 hover:scale-110 transition-transform" />
                  </button>
                  
                  <input
                    type="text"
                    value={input}
                    onChange={handleTyping}
                    placeholder={`Message @${activeChat.friend_username}...`}
                    className="flex-1 min-w-0 bg-transparent border-none text-white placeholder-zinc-500 focus:outline-none focus:ring-0 px-2 sm:px-4 py-2 sm:py-3 text-sm sm:text-base"
                  />
                  
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white p-2 sm:p-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center mr-1"
                  >
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </form>

                {/* Chat Input Emoji Picker Popup */}
                {showChatEmojiPicker && (
                  <div className="absolute bottom-[calc(100%+16px)] left-0 sm:left-4 w-[calc(100vw-16px)] sm:w-[340px] max-h-[50vh] sm:h-[360px] bg-zinc-950/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col z-50 overflow-hidden animate-fade-in-up">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                      <span className="font-bold text-white text-sm">Emojis</span>
                      <button onClick={() => setShowChatEmojiPicker(false)} className="text-zinc-500 hover:text-white transition-colors bg-white/5 p-1 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 ml-1">Custom Emojis</div>
                      <div className="flex flex-wrap gap-1.5">
                        {customEmojis.map((emoji, idx) => (
                          <button 
                            key={idx} 
                            type="button"
                            onClick={() => {
                              setInput(prev => prev + `<:${emoji.name}:${emoji.id}>`);
                              setShowChatEmojiPicker(false);
                            }}
                            className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-xl p-2 transition-colors border border-transparent hover:border-white/5"
                            title={emoji.name}
                          >
                            <img src={emoji.url} alt={emoji.name} className="w-full h-full object-contain drop-shadow-md" />
                          </button>
                        ))}
                      </div>
                      
                      <div className="w-full h-px bg-white/5 my-4" />
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 ml-1">Standard</div>
                      
                      <div className="flex flex-wrap gap-1.5 pb-4">
                        {STANDARD_EMOJIS.map((emoji, idx) => (
                          <button 
                            key={`std-${idx}`} 
                            type="button"
                            onClick={() => {
                              setInput(prev => prev + emoji);
                              setShowChatEmojiPicker(false);
                            }}
                            className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-xl p-1 transition-colors text-3xl border border-transparent hover:border-white/5"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* GIF Picker Popup */}
                {showGifPicker && (
                  <div className="absolute bottom-[calc(100%+16px)] left-0 sm:left-4 w-[calc(100vw-16px)] sm:w-[340px] max-h-[50vh] sm:h-[360px] bg-zinc-950/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col z-50 overflow-hidden animate-fade-in-up">
                    <div className="p-4 border-b border-white/5 flex flex-col gap-3 bg-white/[0.02]">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-sm">Search Tenor GIFs</span>
                        <button onClick={() => setShowGifPicker(false)} className="text-zinc-500 hover:text-white transition-colors bg-white/5 p-1 rounded-lg">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <input 
                        type="text" 
                        value={gifSearch}
                        onChange={(e) => searchGifs(e.target.value)}
                        placeholder="Search for GIFs..."
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar grid grid-cols-2 gap-2">
                      {gifs.map((gif, idx) => (
                        <button 
                          key={idx} 
                          type="button"
                          onClick={() => {
                            sendMessage(undefined, gif.url);
                            setShowGifPicker(false);
                          }}
                          className="rounded-lg overflow-hidden border border-white/5 hover:border-indigo-500 transition-colors h-24 relative group"
                        >
                          <img src={gif.preview_url} className="w-full h-full object-cover" alt="GIF" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-xs font-bold bg-indigo-500 px-2 py-1 rounded">Send</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-transparent relative z-10">
            <button className="md:hidden absolute top-6 left-6 text-zinc-400 bg-white/5 border border-white/10 p-2 rounded-lg" onClick={() => setMobileSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <div className="w-40 h-40 mb-8 opacity-20 pointer-events-none drop-shadow-2xl">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 127.14 96.36">
                <path fill="currentColor" d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83A97.68 97.68 0 0 0 49 6.83a72.37 72.37 0 0 0-3.36-6.83A105.73 105.73 0 0 0 19.43 8.07C2.04 33.6.47 58.74 3.09 83.56a105.73 105.73 0 0 0 32.27 16.17 77.7 77.7 0 0 0 6.89-11.1 82.26 82.26 0 0 1-11.19-5.3 65.42 65.42 0 0 0 2.25-1.74 74.02 74.02 0 0 0 60.54 0 65.51 65.51 0 0 0 2.25 1.74 81.79 81.79 0 0 1-11.19 5.3 77.83 77.83 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.27-16.17c2.9-27.11-2.07-52.61-15.37-75.49ZM42.45 65.69c-6.19 0-11.29-5.65-11.29-12.61 0-6.95 4.96-12.6 11.29-12.6 6.4 0 11.4 5.75 11.29 12.6 0 6.96-4.89 12.61-11.29 12.61Zm42.24 0c-6.19 0-11.29-5.65-11.29-12.61 0-6.95 4.96-12.6 11.29-12.6 6.4 0 11.4 5.75 11.29 12.6 0 6.96-4.9 12.61-11.29 12.61Z"/>
              </svg>
            </div>
            <p className="text-zinc-400 font-bold text-xl tracking-tight">Select a friend to start dropping beats</p>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background-color: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
