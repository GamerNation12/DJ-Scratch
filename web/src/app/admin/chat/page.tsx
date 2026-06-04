"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function ChatPage() {
  const { data: session, status } = useSession();
  
  const [guilds, setGuilds] = useState<any[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  
  const [dmUserId, setDmUserId] = useState("");
  const [openedDms, setOpenedDms] = useState<any[]>([]);
  const [isDmMode, setIsDmMode] = useState(false);
  
  const [inputMessage, setInputMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/admin/discord/guilds")
        .then(r => r.json())
        .then(data => {
          if (!data.error) setGuilds(data);
        });
    }
  }, [status]);

  useEffect(() => {
    if (selectedGuild && !isDmMode) {
      fetch(`/api/admin/discord/channels?guildId=${selectedGuild.id}`)
        .then(r => r.json())
        .then(data => {
          if (!data.error) setChannels(data);
          else setChannels([]);
        });
    }
  }, [selectedGuild, isDmMode]);

  useEffect(() => {
    if (selectedChannel) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    } else {
      setMessages([]);
    }
  }, [selectedChannel]);

  const fetchMessages = async () => {
    if (!selectedChannel) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/admin/discord/messages?channelId=${selectedChannel.id}`);
      const data = await res.json();
      if (!data.error) {
        setMessages(data.reverse()); // Discord returns newest first
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedChannel) return;

    const content = inputMessage;
    setInputMessage("");
    
    // Optimistic UI
    setMessages(prev => [...prev, { id: Date.now().toString(), content, author: { username: "The Goats DJ", bot: true }, timestamp: new Date().toISOString() }]);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    await fetch(`/api/admin/discord/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: selectedChannel.id, content })
    });
    fetchMessages();
  };

  const handleOpenDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmUserId) return;
    const res = await fetch("/api/admin/discord/dms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: dmUserId })
    });
    const channel = await res.json();
    if (!channel.error) {
      if (!openedDms.find(c => c.id === channel.id)) {
        setOpenedDms([...openedDms, channel]);
      }
      setSelectedChannel(channel);
      setIsDmMode(true);
      setSelectedGuild(null);
      setDmUserId("");
    } else {
      alert("Could not open DM. Check User ID.");
    }
  };

  if (status === "loading") return <div className="h-screen bg-[#313338] text-white flex items-center justify-center">Loading...</div>;
  if (!session || (session.user as any)?.id !== "759433582107426816") return null;

  return (
    <div className="flex h-screen bg-[#313338] text-[#dbdee1] font-sans pt-16">
      {/* Left Sidebar (Servers) */}
      <div className="w-[72px] bg-[#1E1F22] flex flex-col items-center py-3 gap-2 overflow-y-auto shrink-0">
        <Link href="/admin" className="w-12 h-12 rounded-full bg-[#313338] hover:bg-indigo-500 hover:rounded-2xl flex items-center justify-center transition-all cursor-pointer text-indigo-400 hover:text-white mb-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Link>
        
        <div className="w-8 h-1 bg-[#313338] rounded-full mb-2"></div>
        
        {/* DM Icon */}
        <div 
          onClick={() => { setIsDmMode(true); setSelectedGuild(null); setSelectedChannel(null); }}
          className={`w-12 h-12 flex items-center justify-center transition-all cursor-pointer text-white relative ${isDmMode ? 'bg-[#5865F2] rounded-2xl' : 'bg-[#313338] rounded-[24px] hover:rounded-2xl hover:bg-[#5865F2]'}`}
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10c1.387 0 2.75-.286 4.024-.821l4.478 1.12a.998.998 0 001.217-1.217l-1.12-4.478C21.214 15.35 22 13.725 22 12c0-5.514-4.486-10-10-10zM8 11h8v2H8v-2z" /></svg>
          {isDmMode && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-2 h-10 bg-white rounded-r-full"></div>}
        </div>

        <div className="w-8 h-[2px] bg-[#313338] rounded-full my-1"></div>

        {/* Server Icons */}
        {guilds.map(guild => (
          <div 
            key={guild.id} 
            onClick={() => { setSelectedGuild(guild); setIsDmMode(false); setSelectedChannel(null); }}
            className={`w-12 h-12 transition-all cursor-pointer relative flex items-center justify-center group ${selectedGuild?.id === guild.id ? 'rounded-2xl' : 'rounded-[24px] hover:rounded-2xl'} bg-[#313338] text-white`}
          >
            {guild.icon ? (
              <img src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`} className={`w-full h-full object-cover transition-all ${selectedGuild?.id === guild.id ? 'rounded-2xl' : 'rounded-[24px] group-hover:rounded-2xl'}`} alt={guild.name} />
            ) : (
              <span className="text-sm font-medium">{guild.name.charAt(0)}</span>
            )}
            {selectedGuild?.id === guild.id && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-2 h-10 bg-white rounded-r-full"></div>}
          </div>
        ))}
      </div>

      {/* Inner Sidebar (Channels / DMs) */}
      <div className="w-60 bg-[#2B2D31] flex flex-col shrink-0">
        <div className="h-12 border-b border-[#1E1F22] flex items-center px-4 font-bold text-white shadow-sm shrink-0">
          {isDmMode ? "Direct Messages" : selectedGuild?.name || "Select a Server"}
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {isDmMode ? (
            <>
              <form onSubmit={handleOpenDm} className="mb-4">
                <input 
                  type="text" 
                  placeholder="Enter User ID..." 
                  value={dmUserId} 
                  onChange={e => setDmUserId(e.target.value)}
                  className="w-full bg-[#1E1F22] text-sm text-white px-3 py-2 rounded-md outline-none placeholder:text-[#949BA4]"
                />
              </form>
              <div className="text-xs font-bold text-[#949BA4] uppercase mb-2 px-2">Recent DMs</div>
              {openedDms.map(dm => (
                <div 
                  key={dm.id} 
                  onClick={() => setSelectedChannel(dm)}
                  className={`flex items-center gap-3 px-2 py-1.5 rounded-md cursor-pointer ${selectedChannel?.id === dm.id ? 'bg-[#404249] text-white' : 'text-[#949BA4] hover:bg-[#35373C] hover:text-[#dbdee1]'}`}
                >
                  <div className="w-8 h-8 rounded-full bg-[#1E1F22] flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                  </div>
                  <span className="truncate">{dm.recipients?.[0]?.username || "Unknown User"}</span>
                </div>
              ))}
            </>
          ) : (
            channels.map(channel => (
              <div 
                key={channel.id} 
                onClick={() => setSelectedChannel(channel)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer ${selectedChannel?.id === channel.id ? 'bg-[#404249] text-white' : 'text-[#949BA4] hover:bg-[#35373C] hover:text-[#dbdee1]'}`}
              >
                <svg className="w-5 h-5 shrink-0 text-[#80848E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                <span className="truncate">{channel.name}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-[#313338] flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 border-b border-[#1E1F22] flex items-center px-4 shadow-sm shrink-0 gap-2">
          {selectedChannel ? (
            <>
              {isDmMode ? (
                <span className="font-bold text-white flex items-center gap-2">
                  <span className="text-xl">@</span>
                  {selectedChannel.recipients?.[0]?.username}
                </span>
              ) : (
                <span className="font-bold text-white flex items-center gap-2">
                  <svg className="w-6 h-6 text-[#80848E]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                  {selectedChannel.name}
                </span>
              )}
            </>
          ) : (
            <span className="text-[#949BA4] font-bold">No Channel Selected</span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {!selectedChannel ? (
            <div className="flex flex-col items-center justify-center h-full text-[#949BA4]">
              <svg className="w-24 h-24 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
              Select a channel or open a DM to start chatting.
            </div>
          ) : (
            <>
              {messages.map((msg, i) => {
                const isConsecutive = i > 0 && messages[i-1].author.id === msg.author.id && (new Date(msg.timestamp).getTime() - new Date(messages[i-1].timestamp).getTime() < 300000);
                return (
                  <div key={msg.id} className={`flex gap-4 hover:bg-[#2E3035] -mx-4 px-4 py-0.5 rounded-sm ${!isConsecutive ? 'mt-4' : ''}`}>
                    {!isConsecutive ? (
                      <img 
                        src={msg.author.avatar ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png` : "/logo.png"} 
                        className="w-10 h-10 rounded-full shrink-0 cursor-pointer" 
                        alt="Avatar"
                      />
                    ) : (
                      <div className="w-10 shrink-0 text-xs text-[#949BA4] flex items-center justify-center opacity-0 hover:opacity-100">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    <div className="min-w-0">
                      {!isConsecutive && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="font-medium text-white hover:underline cursor-pointer">{msg.author.username}</span>
                          {msg.author.bot && <span className="bg-[#5865F2] text-white text-[10px] px-1 rounded-sm flex items-center">BOT</span>}
                          <span className="text-xs text-[#949BA4]">
                            {new Date(msg.timestamp).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                      <div className="text-[#dbdee1] leading-tight break-words whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 shrink-0">
          <form onSubmit={handleSendMessage} className="bg-[#383A40] rounded-lg p-3 flex gap-4 items-center">
            <input 
              type="text" 
              disabled={!selectedChannel}
              placeholder={selectedChannel ? `Message ${isDmMode ? '@' + selectedChannel.recipients?.[0]?.username : '#' + selectedChannel.name}` : "Select a channel..."}
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              className="flex-1 bg-transparent text-white outline-none placeholder:text-[#949BA4]"
            />
            <button type="submit" disabled={!selectedChannel || !inputMessage.trim()} className="text-[#949BA4] hover:text-[#dbdee1] disabled:opacity-50">
              <svg className="w-6 h-6 transform rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
