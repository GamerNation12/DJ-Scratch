"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import io, { Socket } from "socket.io-client";
import { Send, User, MessageSquare, AlertCircle, Trash2, RefreshCw, Smile, Menu, X } from "lucide-react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";

// Discord Colors
// Background (Chat): #313338
// Sidebar (Friends): #2b2d31
// Top bar (Header): #313338 (same as chat but with border)
// Input Bar: #383a40
// Text Normal: #dbdee1
// Text Muted: #949ba4
// Primary Blue: #5865F2
// Message Hover: #2e3035

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
  const [customEmojis, setCustomEmojis] = useState<any[]>([]);
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<number | null>(null);
  const [showChatEmojiPicker, setShowChatEmojiPicker] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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
          } else if (allFriends.length > 0 && !activeChat) {
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

  const renderMessageContent = (content: string) => {
    const regex = /<a?:([^:]+):(\d+)>/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`md-${lastIndex}`} className="inline [&>p]:inline [&_a]:text-[#00A8FC] hover:[&_a]:underline [&_strong]:font-bold [&_em]:italic break-words text-[15px]">
            <ReactMarkdown>{content.substring(lastIndex, match.index)}</ReactMarkdown>
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
          className="inline-block w-6 h-6 object-contain align-middle mx-0.5 pointer-events-none select-none" 
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      );
      
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < content.length) {
      parts.push(
        <span key={`md-${lastIndex}`} className="inline [&>p]:inline [&_a]:text-[#00A8FC] hover:[&_a]:underline [&_strong]:font-bold [&_em]:italic break-words text-[15px]">
          <ReactMarkdown>{content.substring(lastIndex)}</ReactMarkdown>
        </span>
      );
    }
    
    return parts.length > 0 ? parts : content;
  };

  const getAvatar = (user: any) => {
    if (user.avatar_url) return user.avatar_url;
    return `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`; // Fallback for Discord
  };

  return (
    <div className="w-screen h-screen flex overflow-hidden bg-[#313338] text-[#dbdee1] font-sans selection:bg-[#5865F2]/50 selection:text-white">
      
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Sidebar - Friends List */}
      <div className={`
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 transition-transform absolute md:relative z-50
        w-[240px] h-full bg-[#2b2d31] flex flex-col flex-shrink-0
      `}>
        {/* Sidebar Header */}
        <div className="h-12 border-b border-[#1f2023] flex items-center px-4 shadow-[0_1px_2px_rgba(0,0,0,0.2)] z-10">
          <div className="w-full bg-[#1e1f22] rounded text-sm px-2 py-1 text-[#949ba4] font-medium cursor-pointer">
            Find or start a conversation
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto pt-2 px-2 custom-scrollbar">
          <h2 className="px-3 py-1 text-[11px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
            Direct Messages
          </h2>
          
          {friends.length === 0 ? (
            <p className="text-[#949ba4] text-xs p-3 text-center">No friends yet. Add some!</p>
          ) : (
            friends.map(f => {
              const isActive = activeChat?.friend_id === f.friend_id;
              const name = f.display_name || f.friend_username;
              return (
                <button
                  key={f.friend_id}
                  onClick={() => {
                    setActiveChat(f);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-2 py-[6px] rounded mb-[2px] transition-colors group ${
                    isActive ? "bg-[#404249] text-white" : "hover:bg-[#35373c] hover:text-[#dbdee1] text-[#949ba4]"
                  }`}
                >
                  <div className="relative">
                    <img src={getAvatar(f)} className="w-8 h-8 rounded-full bg-[#1e1f22]" alt="" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#23a559] border-2 border-[#2b2d31] rounded-full"></div>
                  </div>
                  <span className={`font-medium text-sm truncate ${isActive ? 'text-white' : 'group-hover:text-white'}`}>
                    {name}
                  </span>
                </button>
              );
            })
          )}
        </div>
        
        {/* User Profile Bar (bottom left) */}
        <div className="h-[52px] bg-[#232428] flex items-center px-2 flex-shrink-0">
          <div className="flex items-center gap-2 hover:bg-[#3f4147] rounded p-1 cursor-pointer transition-colors w-full">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <span className="font-bold text-white text-sm">ME</span>
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-white leading-tight truncate">You</span>
              <span className="text-[11px] text-[#949ba4] leading-tight truncate">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#313338]">
        
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-12 border-b border-[#1f2023] flex items-center px-4 shadow-[0_1px_2px_rgba(0,0,0,0.2)] z-10 flex-shrink-0 bg-[#313338]">
              <button className="md:hidden mr-3 text-[#949ba4]" onClick={() => setMobileSidebarOpen(true)}>
                <Menu className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[#80848e] text-2xl font-light mb-1">@</span>
                <h3 className="font-semibold text-white">{activeChat.display_name || activeChat.friend_username}</h3>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar relative">
              {messages.length === 0 ? (
                <div className="flex flex-col justify-end min-h-full pb-4">
                  <div className="w-20 h-20 bg-[#2b2d31] rounded-full flex items-center justify-center mb-4">
                    <User className="w-10 h-10 text-[#dbdee1]" />
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">
                    {activeChat.display_name || activeChat.friend_username}
                  </h1>
                  <p className="text-base text-[#949ba4]">
                    This is the beginning of your direct message history with <strong className="text-[#dbdee1]">@{activeChat.friend_username}</strong>.
                  </p>
                </div>
              ) : (
                <div className="space-y-[2px]">
                  {messages.map((m, index) => {
                    const isMe = m.sender_id === myId && !m.is_bot;
                    const prevMsg = messages[index - 1];
                    // Group messages if they are from the same sender and within 5 minutes
                    const isGrouped = prevMsg 
                      && prevMsg.sender_id === m.sender_id 
                      && prevMsg.is_bot === m.is_bot 
                      && (new Date(m.sent_at).getTime() - new Date(prevMsg.sent_at).getTime() < 300000);

                    return (
                      <div 
                        key={m.id} 
                        className={`group flex items-start hover:bg-[#2e3035] pl-4 pr-12 relative ${isGrouped ? 'py-[2px]' : 'py-3 mt-4'}`}
                      >
                        {/* Avatar Column */}
                        <div className="w-[40px] flex-shrink-0 mr-4 flex justify-center mt-0.5">
                          {!isGrouped ? (
                            isMe ? (
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center cursor-pointer">
                                <span className="font-bold text-white text-sm">ME</span>
                              </div>
                            ) : (
                              <img src={getAvatar(activeChat)} className="w-10 h-10 rounded-full cursor-pointer bg-[#1e1f22]" alt="" />
                            )
                          ) : (
                            <span className="text-[10px] text-[#949ba4] opacity-0 group-hover:opacity-100 mt-1 select-none w-10 text-right pr-2">
                              {new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        {/* Message Content */}
                        <div className="flex-1 min-w-0">
                          {!isGrouped && (
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className={`font-medium text-base hover:underline cursor-pointer ${m.is_bot ? 'text-[#5865F2]' : 'text-white'}`}>
                                {isMe ? 'You' : (m.is_bot ? 'DJ Scratch' : (activeChat.display_name || activeChat.friend_username))}
                              </span>
                              {m.is_bot && (
                                <span className="bg-[#5865F2] text-white text-[10px] uppercase font-bold px-1.5 py-[2px] rounded inline-flex items-center gap-1">
                                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" clipRule="evenodd" d="M16 8A8 8 0 110 8a8 8 0 0116 0zm-4.7-2.7a1 1 0 00-1.4 0L7.5 7.79 6.1 6.3a1 1 0 00-1.4 1.4l2.1 2.1c.4.4 1 .4 1.4 0l3.1-3.1a1 1 0 000-1.4z"/></svg>
                                  BOT
                                </span>
                              )}
                              <span className="text-xs text-[#949ba4] font-medium ml-1">
                                {new Date(m.sent_at).toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' })} {new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                          
                          <div className={`text-[#dbdee1] ${m.isSending ? 'opacity-60' : ''}`}>
                            {m.failed && (
                              <span className="text-red-400 mr-2" title="Failed to send">
                                <AlertCircle className="w-4 h-4 inline-block -mt-1" />
                              </span>
                            )}
                            {renderMessageContent(m.content)}
                          </div>

                          {/* Reactions */}
                          {m.reactions && m.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {m.reactions.map((r: any, idx: number) => (
                                <div key={idx} className="bg-[#2b2d31] hover:bg-[#35373c] hover:border-[#5865F2] cursor-pointer px-1.5 py-0.5 rounded-lg flex items-center border border-transparent transition-colors">
                                  <img src={r.url} alt={r.name} className="w-4 h-4 object-contain" title={r.name} />
                                  <span className="text-xs font-bold text-[#b5bac1] ml-1.5 mr-1">1</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Failed Actions */}
                          {m.failed && (
                            <div className="flex gap-2 mt-1">
                              <button onClick={() => sendMessage(undefined, m.content, m.id)} className="text-xs text-red-400 hover:underline">Retry</button>
                              <button onClick={() => deleteFailedMessage(m.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                            </div>
                          )}
                        </div>

                        {/* Hover Actions (Emoji Picker Button) */}
                        {!m.isSending && !m.failed && (
                          <div className="absolute right-4 -top-3 hidden group-hover:flex bg-[#313338] border border-[#1f2023] rounded-md shadow-sm overflow-hidden z-20">
                            <button 
                              onClick={() => setShowEmojiPickerFor(showEmojiPickerFor === m.id ? null : m.id)}
                              className="p-1.5 text-[#b5bac1] hover:bg-[#404249] hover:text-[#dbdee1] transition-colors"
                              title="Add Reaction"
                            >
                              <Smile className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* Reaction Picker Popup */}
                        {showEmojiPickerFor === m.id && (
                          <div className="absolute z-50 right-12 top-0 w-64 max-h-48 overflow-y-auto bg-[#2b2d31] border border-[#1f2023] rounded-lg p-2 shadow-2xl flex flex-wrap gap-1 custom-scrollbar">
                            <div className="w-full flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-[#b5bac1] uppercase tracking-wider ml-1">React</span>
                              <button onClick={() => setShowEmojiPickerFor(null)} className="text-[#b5bac1] hover:text-white p-1">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            {customEmojis.map((emoji) => (
                              <button
                                key={emoji.id}
                                onClick={() => handleReact(m.id, emoji)}
                                className="w-9 h-9 rounded flex items-center justify-center p-1 hover:bg-[#404249] transition-colors"
                                title={emoji.name}
                              >
                                <img src={emoji.url} alt={emoji.name} className="w-full h-full object-contain" />
                              </button>
                            ))}
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
            <div className="px-4 pb-6 pt-0 bg-[#313338] flex-shrink-0">
              <div className="relative">
                <form 
                  onSubmit={sendMessage} 
                  className="bg-[#383a40] rounded-lg flex items-center pr-2 pl-4 min-h-[44px]"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={`Message @${activeChat.friend_username}`}
                    className="flex-1 bg-transparent border-none text-[#dbdee1] placeholder-[#87898f] focus:outline-none focus:ring-0 py-3"
                  />
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowChatEmojiPicker(!showChatEmojiPicker)}
                      className="p-1.5 text-[#b5bac1] hover:text-[#dbdee1] transition-colors"
                      title="Select Emoji"
                    >
                      <Smile className="w-6 h-6 hover:scale-110 transition-transform" />
                    </button>
                    {/* Send Button is hidden in Discord usually, hitting Enter sends, but we'll include it for mobile */}
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="md:hidden p-1.5 text-[#5865F2] hover:text-[#4752c4] disabled:opacity-50 transition-colors"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </form>

                {/* Chat Input Emoji Picker Popup */}
                {showChatEmojiPicker && (
                  <div className="absolute bottom-[calc(100%+8px)] right-0 w-[320px] h-[320px] bg-[#2b2d31] border border-[#1f2023] rounded-lg shadow-2xl flex flex-col z-50 overflow-hidden">
                    <div className="p-3 border-b border-[#1f2023] flex justify-between items-center bg-[#2b2d31]">
                      <span className="font-bold text-white text-sm">Emoji</span>
                      <button onClick={() => setShowChatEmojiPicker(false)} className="text-[#949ba4] hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                      <div className="text-xs font-bold text-[#949ba4] uppercase tracking-wider mb-2 ml-1">Custom Emojis</div>
                      <div className="flex flex-wrap gap-1">
                        {customEmojis.map((emoji, idx) => (
                          <button 
                            key={idx} 
                            type="button"
                            onClick={() => {
                              setInput(prev => prev + `<:${emoji.name}:${emoji.id}>`);
                              setShowChatEmojiPicker(false);
                            }}
                            className="w-10 h-10 flex items-center justify-center hover:bg-[#404249] rounded p-1.5 transition-colors"
                            title={emoji.name}
                          >
                            <img src={emoji.url} alt={emoji.name} className="w-full h-full object-contain" />
                          </button>
                        ))}
                      </div>
                      
                      <div className="w-full h-[1px] bg-[#3f4147] my-3" />
                      <div className="text-xs font-bold text-[#949ba4] uppercase tracking-wider mb-2 ml-1">Standard</div>
                      
                      <div className="flex flex-wrap gap-1 pb-4">
                        {STANDARD_EMOJIS.map((emoji, idx) => (
                          <button 
                            key={`std-${idx}`} 
                            type="button"
                            onClick={() => {
                              setInput(prev => prev + emoji);
                              setShowChatEmojiPicker(false);
                            }}
                            className="w-10 h-10 flex items-center justify-center hover:bg-[#404249] rounded p-1 transition-colors text-2xl"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-[#313338]">
            <button className="md:hidden absolute top-4 left-4 text-[#949ba4]" onClick={() => setMobileSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <div className="w-32 h-32 mb-6 opacity-30 pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 127.14 96.36">
                <path fill="currentColor" d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83A97.68 97.68 0 0 0 49 6.83a72.37 72.37 0 0 0-3.36-6.83A105.73 105.73 0 0 0 19.43 8.07C2.04 33.6.47 58.74 3.09 83.56a105.73 105.73 0 0 0 32.27 16.17 77.7 77.7 0 0 0 6.89-11.1 82.26 82.26 0 0 1-11.19-5.3 65.42 65.42 0 0 0 2.25-1.74 74.02 74.02 0 0 0 60.54 0 65.51 65.51 0 0 0 2.25 1.74 81.79 81.79 0 0 1-11.19 5.3 77.83 77.83 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.27-16.17c2.9-27.11-2.07-52.61-15.37-75.49ZM42.45 65.69c-6.19 0-11.29-5.65-11.29-12.61 0-6.95 4.96-12.6 11.29-12.6 6.4 0 11.4 5.75 11.29 12.6 0 6.96-4.89 12.61-11.29 12.61Zm42.24 0c-6.19 0-11.29-5.65-11.29-12.61 0-6.95 4.96-12.6 11.29-12.6 6.4 0 11.4 5.75 11.29 12.6 0 6.96-4.9 12.61-11.29 12.61Z"/>
              </svg>
            </div>
            <p className="text-[#949ba4] font-medium text-lg">Select a friend to start chatting</p>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background-color: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #1a1b1e;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #111214;
        }
      `}</style>
    </div>
  );
}
