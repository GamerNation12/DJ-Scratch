"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// --- Types ---
interface User {
  id: string;
  username: string;
  avatar: string | null;
  bot?: boolean;
}

interface Guild {
  id: string;
  name: string;
  icon: string | null;
}

interface Channel {
  id: string;
  type: number;
  name?: string; 
  parent_id?: string | null;
  position?: number;
  recipients?: User[]; 
}

interface Member {
  user: User;
  nick?: string | null;
  roles: string[];
}

interface Attachment {
  id: string;
  url: string;
  filename: string;
  content_type?: string;
}

interface Embed {
  title?: string;
  description?: string;
  color?: number;
  image?: { url: string };
  thumbnail?: { url: string };
  author?: { name: string; icon_url?: string };
}

interface Reaction {
  emoji: { name: string; id: string | null };
  count: number;
}

interface Message {
  id: string;
  content: string;
  author: User;
  timestamp: string;
  attachments?: Attachment[];
  embeds?: Embed[];
  reactions?: Reaction[];
  referenced_message?: Message;
}

// --- Icons ---
const Icons = {
  Hashtag: () => <svg className="w-[18px] h-[18px] text-[#80848E] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41045 9L8.35045 15H14.3504L15.4104 9H9.41045Z" /></svg>,
  Voice: () => <svg className="w-[18px] h-[18px] text-[#80848E] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 8.00204H3C2.45 8.00204 2 8.45304 2 9.00204V15.002C2 15.552 2.45 16.002 3 16.002H6L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20.002V4.00204C12 3.59904 11.757 3.23204 11.383 3.07904ZM14 5.00195V7.00195C16.757 7.00195 19 9.24595 19 12.002C19 14.759 16.757 17.002 14 17.002V19.002C17.86 19.002 21 15.863 21 12.002C21 8.14295 17.86 5.00195 14 5.00195ZM14 9.00195C15.654 9.00195 17 10.349 17 12.002C17 13.657 15.654 15.002 14 15.002V13.002C14.551 13.002 15 12.553 15 12.002C15 11.451 14.551 11.002 14 11.002V9.00195Z" /></svg>,
  Rules: () => <svg className="w-[18px] h-[18px] text-[#80848E] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 19.93C7.05 19.43 4 16.05 4 12C4 7.95 7.05 4.57 11 4.07V19.93ZM13 4.07C16.95 4.57 20 7.95 20 12C20 16.05 16.95 19.43 13 19.93V4.07Z"/></svg>,
  Announcement: () => <svg className="w-[18px] h-[18px] text-[#80848E] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M14 10.88V9C14 7.34 12.66 6 11 6C9.34 6 8 7.34 8 9V10.88C7.45 11.16 7 11.75 7 12.44V16C7 17.1 7.9 18 9 18H13C14.1 18 15 17.1 15 16V12.44C15 11.75 14.55 11.16 14 10.88ZM11 16.5C10.17 16.5 9.5 15.83 9.5 15C9.5 14.17 10.17 13.5 11 13.5C11.83 13.5 12.5 14.17 12.5 15C12.5 15.83 11.83 16.5 11 16.5Z" /></svg>,
  Threads: () => <svg className="w-6 h-6 text-[#B5BAC1] hover:text-[#DBDEE1] cursor-pointer" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z"/></svg>,
  Inbox: () => <svg className="w-6 h-6 text-[#B5BAC1] hover:text-[#DBDEE1] cursor-pointer" fill="currentColor" viewBox="0 0 24 24"><path d="M21 16V6C21 4.9 20.1 4 19 4H5C3.9 4 3 4.9 3 6V16C3 17.1 3.9 18 5 18H19C20.1 18 21 17.1 21 16ZM5 6H19V16H5V6ZM12 14C10.9 14 10 13.1 10 12C10 10.9 10.9 10 12 10C13.1 10 14 10.9 14 12C14 13.1 13.1 14 12 14Z"/></svg>,
  Help: () => <svg className="w-6 h-6 text-[#B5BAC1] hover:text-[#DBDEE1] cursor-pointer" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 19H11V17H13V19ZM15.07 11.25L14.17 12.17C13.45 12.9 13 13.5 13 15H11V14.5C11 13.4 11.45 12.4 12.17 11.67L13.41 10.41C13.78 10.05 14 9.55 14 9C14 7.9 13.1 7 12 7C10.9 7 10 7.9 10 9H8C8 6.79 9.79 5 12 5C14.21 5 16 6.79 16 9C16 9.88 15.64 10.68 15.07 11.25Z"/></svg>,
  Plus: () => <svg className="w-[22px] h-[22px] text-[#B5BAC1]" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2ZM13 11H17V13H13V17H11V13H7V11H11V7H13V11Z" /></svg>,
  Gift: () => <svg className="w-6 h-6 text-[#B5BAC1] hover:text-[#DBDEE1] cursor-pointer" fill="currentColor" viewBox="0 0 24 24"><path d="M20 7H15.82C15.94 6.7 16 6.36 16 6C16 3.79 14.21 2 12 2C9.79 2 8 3.79 8 6C8 6.36 8.06 6.7 8.18 7H4C2.9 7 2 7.9 2 9V12H22V9C22 7.9 21.1 7 20 7ZM10 6C10 4.9 10.9 4 12 4C13.1 4 14 4.9 14 6C14 7.1 13.1 8 12 8C10.9 8 10 7.1 10 6ZM4 14V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V14H4Z" /></svg>,
  Gif: () => <svg className="w-6 h-6 text-[#B5BAC1] hover:text-[#DBDEE1] cursor-pointer" fill="currentColor" viewBox="0 0 24 24"><path d="M19 19H5C3.89 19 3 18.11 3 17V7C3 5.89 3.89 5 5 5H19C20.11 5 21 5.89 21 7V17C21 18.11 20.11 19 19 19ZM11 10.5H8.5V13.5H11V15H8.5C7.67 15 7 14.33 7 13.5V10.5C7 9.67 7.67 9 8.5 9H11V10.5ZM13.5 15H12V9H13.5V15ZM17 10.5H15.5V11.5H17V13H15.5V15H14V9H17V10.5Z" /></svg>,
  Sticker: () => <svg className="w-6 h-6 text-[#B5BAC1] hover:text-[#DBDEE1] cursor-pointer" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM8.5 8C9.33 8 10 8.67 10 9.5C10 10.33 9.33 11 8.5 11C7.67 11 7 10.33 7 9.5C7 8.67 7.67 8 8.5 8ZM15.5 8C16.33 8 17 8.67 17 9.5C17 10.33 16.33 11 15.5 11C14.67 11 14 10.33 14 9.5C14 8.67 14.67 8 15.5 8ZM12 18C9.64 18 7.63 16.53 6.81 14.5C8.36 15.65 10.15 16.29 12 16.29C13.85 16.29 15.64 15.65 17.19 14.5C16.37 16.53 14.36 18 12 18Z"/></svg>,
  Emoji: () => <svg className="w-6 h-6 text-[#B5BAC1] hover:text-[#FFC107] cursor-pointer transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2ZM8.5 9.5C9.328 9.5 10 8.828 10 8C10 7.172 9.328 6.5 8.5 6.5C7.672 6.5 7 7.172 7 8C7 8.828 7.672 9.5 8.5 9.5ZM15.5 9.5C16.328 9.5 17 8.828 17 8C17 7.172 16.328 6.5 15.5 6.5C14.672 6.5 14 7.172 14 8C14 8.828 14.672 9.5 15.5 9.5ZM12 17.5C9.33 17.5 7.08 15.82 6 13.5H18C16.92 15.82 14.67 17.5 12 17.5Z" /></svg>
};

// --- Helper Functions ---
function getChannelIcon(type: number) {
  if (type === 2) return <Icons.Voice />;
  if (type === 5) return <Icons.Announcement />;
  return <Icons.Hashtag />;
}

// --- Main Page Component ---
export default function ChatPage() {
  const { data: session, status } = useSession();
  
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [openedDms, setOpenedDms] = useState<Channel[]>([]);
  const [isDmMode, setIsDmMode] = useState(false);
  
  const [inputMessage, setInputMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/admin/discord/guilds")
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setGuilds(data);
          else setError("Failed to load servers.");
        })
        .catch(() => setError("Network error fetching servers."));
    }
  }, [status]);

  useEffect(() => {
    if (selectedGuild && !isDmMode) {
      fetch(`/api/admin/discord/channels?guildId=${selectedGuild.id}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            // Sort by position
            data.sort((a, b) => (a.position || 0) - (b.position || 0));
            setChannels(data);
          } else {
            setChannels([]);
          }
        });
      
      fetch(`/api/admin/discord/members?guildId=${selectedGuild.id}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setMembers(data.filter(m => !m.user.bot)); 
          else setMembers([]);
        });
    }
  }, [selectedGuild, isDmMode]);

  useEffect(() => {
    if (selectedChannel) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000); // Poll faster
      return () => clearInterval(interval);
    } else {
      setMessages([]);
    }
  }, [selectedChannel]);

  const fetchMessages = async () => {
    if (!selectedChannel || (selectedChannel.type !== 0 && selectedChannel.type !== 5 && selectedChannel.type !== 1)) return; // Only fetch text/announcement/dm
    try {
      const res = await fetch(`/api/admin/discord/messages?channelId=${selectedChannel.id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data.reverse()); 
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch (e) {}
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedChannel) return;

    const content = inputMessage;
    const replyToId = replyingTo?.id;
    setInputMessage("");
    setReplyingTo(null);
    
    const optimisticMsg: Message = {
      id: Date.now().toString(),
      content,
      author: { id: "bot", username: "The Goats DJ", avatar: null, bot: true },
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    try {
      const res = await fetch(`/api/admin/discord/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selectedChannel.id, content, replyToId })
      });
      if (!res.ok) setError("Failed to send message. Might be rate limited.");
      fetchMessages();
    } catch (e) {
      setError("Network error sending message.");
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    setReactingTo(null);
    try {
      const res = await fetch("/api/admin/discord/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selectedChannel?.id, messageId, emoji })
      });
      if (!res.ok) setError("Failed to add reaction.");
      fetchMessages();
    } catch (e) {
      setError("Network error adding reaction.");
    }
  };

  const handleOpenDmWithUser = async (userId: string) => {
    try {
      const res = await fetch("/api/admin/discord/dms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const channel = await res.json();
      if (channel.id) {
        if (!openedDms.find(c => c.id === channel.id)) setOpenedDms(prev => [...prev, channel]);
        setSelectedChannel(channel);
        setIsDmMode(true);
        setSelectedGuild(null);
      } else {
        setError(channel.error || "Could not open DM.");
      }
    } catch (e) {
      setError("Network error opening DM.");
    }
  };



  const toggleCategory = (id: string) => {
    setCollapsedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (status === "loading") return <div className="h-screen bg-[#313338] text-white flex items-center justify-center">Loading interface...</div>;
  if (!session || (session.user as any)?.id !== "759433582107426816") return null;

  // Process Categories
  const categories = channels.filter(c => c.type === 4);
  const orphanChannels = channels.filter(c => !c.parent_id && c.type !== 4);

  return (
    <div className="flex h-screen bg-[#313338] text-[#DBDEE1] font-['gg_sans','Noto_Sans','Helvetica_Neue',sans-serif] pt-16 overflow-hidden">
      
      {/* Toast Error */}
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-[#F23F42] text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 hover:text-red-200 font-bold">✕</button>
        </div>
      )}

      {/* --- LEFT SIDEBAR: SERVERS --- */}
      <div className="w-[72px] bg-[#1E1F22] flex flex-col items-center py-3 gap-2 overflow-y-auto shrink-0 no-scrollbar">
        <Link href="/admin" className="w-12 h-12 rounded-full bg-[#313338] hover:bg-[#5865F2] hover:rounded-2xl flex items-center justify-center transition-all cursor-pointer text-[#DBDEE1] hover:text-white mb-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Link>
        <div className="w-8 h-[2px] bg-[#313338] rounded-full mb-2"></div>
        
        {/* DM Icon */}
        <div 
          onClick={() => { setIsDmMode(true); setSelectedGuild(null); setSelectedChannel(null); }}
          className={`w-12 h-12 flex items-center justify-center transition-all cursor-pointer text-[#DBDEE1] relative group ${isDmMode ? 'bg-[#5865F2] rounded-2xl text-white' : 'bg-[#313338] rounded-[24px] hover:rounded-2xl hover:bg-[#5865F2] hover:text-white'}`}
        >
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10c1.387 0 2.75-.286 4.024-.821l4.478 1.12a.998.998 0 001.217-1.217l-1.12-4.478C21.214 15.35 22 13.725 22 12c0-5.514-4.486-10-10-10zM8 11h8v2H8v-2z" /></svg>
          <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-2 bg-white rounded-r-full transition-all ${isDmMode ? 'h-10' : 'h-0 group-hover:h-5'}`}></div>
        </div>
        <div className="w-8 h-[2px] bg-[#313338] rounded-full my-1"></div>

        {/* Server List */}
        {guilds.map(guild => (
          <div 
            key={guild.id} 
            onClick={() => { setSelectedGuild(guild); setIsDmMode(false); setSelectedChannel(null); }}
            className={`w-12 h-12 transition-all cursor-pointer relative flex items-center justify-center group ${selectedGuild?.id === guild.id ? 'rounded-2xl bg-[#5865F2] text-white' : 'rounded-[24px] hover:rounded-2xl hover:bg-[#5865F2] bg-[#313338] text-[#DBDEE1] hover:text-white'}`}
          >
            {guild.icon ? (
              <img src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`} className={`w-full h-full object-cover transition-all ${selectedGuild?.id === guild.id ? 'rounded-2xl' : 'rounded-[24px] group-hover:rounded-2xl'}`} alt={guild.name} />
            ) : (
              <span className="text-sm font-medium">{guild.name.charAt(0)}</span>
            )}
            <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-2 bg-white rounded-r-full transition-all ${selectedGuild?.id === guild.id ? 'h-10' : 'h-0 group-hover:h-5'}`}></div>
          </div>
        ))}
      </div>

      {/* --- MIDDLE SIDEBAR: CHANNELS / DMS --- */}
      <div className="w-60 bg-[#2B2D31] flex flex-col shrink-0 rounded-tl-lg">
        <div className="h-12 border-b border-[#1E1F22] flex items-center px-4 shadow-sm shrink-0 cursor-pointer hover:bg-[#35373C] transition-colors">
          <span className="font-bold text-white truncate flex-1">{isDmMode ? "Direct Messages" : selectedGuild?.name || "Select a Server"}</span>
          {!isDmMode && selectedGuild && <svg className="w-4 h-4 text-[#DBDEE1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
          {isDmMode ? (
            <>
              <div className="px-2 pt-4 pb-1">
                <h2 className="text-xs font-bold text-[#949BA4] uppercase hover:text-[#DBDEE1] cursor-pointer flex items-center">
                  Direct Messages
                </h2>
              </div>
              {openedDms.map(dm => (
                <div 
                  key={dm.id} 
                  onClick={() => setSelectedChannel(dm)}
                  className={`flex items-center gap-3 px-2 py-1.5 rounded-md cursor-pointer group ${selectedChannel?.id === dm.id ? 'bg-[#404249] text-white' : 'text-[#949BA4] hover:bg-[#35373C] hover:text-[#DBDEE1]'}`}
                >
                  <div className="w-8 h-8 rounded-full bg-[#1E1F22] flex items-center justify-center shrink-0 overflow-hidden relative">
                    {dm.recipients?.[0]?.avatar ? (
                      <img src={`https://cdn.discordapp.com/avatars/${dm.recipients[0].id}/${dm.recipients[0].avatar}.png`} className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    )}
                  </div>
                  <span className="truncate">{dm.recipients?.[0]?.username || "Unknown User"}</span>
                </div>
              ))}
            </>
          ) : (
            <>
              {orphanChannels.map(channel => (
                <div 
                  key={channel.id} 
                  onClick={() => setSelectedChannel(channel)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer group mb-[2px] ${selectedChannel?.id === channel.id ? 'bg-[#404249] text-white' : 'text-[#949BA4] hover:bg-[#35373C] hover:text-[#DBDEE1]'}`}
                >
                  {getChannelIcon(channel.type)}
                  <span className="truncate">{channel.name}</span>
                </div>
              ))}

              {categories.map(cat => {
                const isCollapsed = collapsedCategories[cat.id];
                const children = channels.filter(c => c.parent_id === cat.id);
                return (
                  <div key={cat.id} className="pt-4">
                    <div 
                      className="flex items-center px-0.5 cursor-pointer hover:text-[#DBDEE1] text-[#949BA4] group mb-1"
                      onClick={() => toggleCategory(cat.id)}
                    >
                      <svg className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6-1.41-1.41z"/></svg>
                      <h2 className="text-xs font-bold uppercase ml-0.5 truncate tracking-wide">{cat.name}</h2>
                    </div>
                    {!isCollapsed && children.map(channel => (
                      <div 
                        key={channel.id} 
                        onClick={() => setSelectedChannel(channel)}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer group mb-[2px] ${selectedChannel?.id === channel.id ? 'bg-[#404249] text-white' : 'text-[#949BA4] hover:bg-[#35373C] hover:text-[#DBDEE1]'}`}
                      >
                        {getChannelIcon(channel.type)}
                        <span className="truncate">{channel.name}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
        
        {/* User Profile Bar */}
        <div className="h-[52px] bg-[#232428] shrink-0 flex items-center px-2 gap-2">
          <div className="w-8 h-8 rounded-full bg-[#1E1F22] flex items-center justify-center overflow-hidden shrink-0">
             <img src="/logo.png" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col min-w-0 flex-1 hover:bg-[#35373C] cursor-pointer rounded px-1 py-0.5">
            <span className="text-sm font-bold text-white truncate leading-tight">The Goats DJ</span>
            <span className="text-[11px] text-[#949BA4] truncate leading-tight">#0000</span>
          </div>
        </div>
      </div>

      {/* --- MAIN CHAT AREA --- */}
      <div className="flex-1 bg-[#313338] flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 border-b border-[#1E1F22] flex items-center px-4 shadow-sm shrink-0 justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {selectedChannel ? (
              <>
                {isDmMode ? (
                  <span className="font-bold text-white flex items-center gap-2">
                    <span className="text-2xl text-[#80848E] font-light">@</span>
                    {selectedChannel.recipients?.[0]?.username}
                  </span>
                ) : (
                  <span className="font-bold text-white flex items-center gap-2">
                    {getChannelIcon(selectedChannel.type)}
                    {selectedChannel.name}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[#949BA4] font-bold">No Channel Selected</span>
            )}
          </div>
          
          <div className="flex items-center gap-4 shrink-0">
            <Icons.Threads />
            <Icons.Inbox />
            <Icons.Help />
            <div className="bg-[#1E1F22] rounded flex items-center px-2 py-1 w-36 h-6">
              <span className="text-xs text-[#949BA4] flex-1">Search</span>
              <svg className="w-4 h-4 text-[#949BA4]" fill="currentColor" viewBox="0 0 24 24"><path d="M21.707 20.293L16.314 14.9C17.403 13.504 18 11.799 18 10C18 5.589 14.411 2 10 2C5.589 2 2 5.589 2 10C2 14.411 5.589 18 10 18C11.799 18 13.504 17.404 14.9 16.314L20.293 21.707C20.488 21.902 20.744 22 21 22C21.256 22 21.512 21.902 21.707 21.707C22.098 21.316 22.098 20.684 21.707 20.293ZM10 16C6.691 16 4 13.309 4 10C4 6.691 6.691 4 10 4C13.309 4 16 6.691 16 10C16 13.309 13.309 16 10 16Z"/></svg>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar relative">
          {!selectedChannel ? (
            <div className="flex flex-col items-center justify-center h-full text-[#949BA4]">
              Select a channel to start chatting.
            </div>
          ) : (
            <div className="flex flex-col justify-end min-h-full">
              {messages.length > 0 && (
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-white mb-2">
                    {isDmMode ? selectedChannel.recipients?.[0]?.username : `Welcome to #${selectedChannel.name}!`}
                  </h1>
                  <p className="text-[#949BA4]">
                    {isDmMode ? `This is the beginning of your direct message history with @${selectedChannel.recipients?.[0]?.username}.` : `This is the start of the #${selectedChannel.name} channel.`}
                  </p>
                </div>
              )}
              {messages.map((msg, i) => {
                const prevMsg = messages[i-1];
                const isConsecutive = prevMsg && prevMsg.author.id === msg.author.id && (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() < 300000);
                
                return (
                  <div key={msg.id} className={`group flex gap-4 hover:bg-[#2E3035] -mx-4 px-4 py-[2px] relative ${!isConsecutive || msg.referenced_message ? 'mt-[17px]' : ''}`}>
                    {/* Hover Action Bar */}
                    <div className="absolute right-4 -top-4 bg-[#313338] border border-[#2B2D31] rounded-md shadow-sm hidden group-hover:flex items-center z-10">
                      <div className="p-2 hover:bg-[#404249] cursor-pointer rounded-l-md text-[#B5BAC1] hover:text-[#DBDEE1] relative" onClick={() => setReactingTo(reactingTo === msg.id ? null : msg.id)}>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z"/></svg>
                        {/* Mini Reaction Picker */}
                        {reactingTo === msg.id && (
                          <div className="absolute top-10 right-0 bg-[#2B2D31] border border-[#1E1F22] rounded-md p-2 flex gap-2 shadow-lg z-50">
                            {['👍', '🔥', '😂', '❤️', '💀'].map(emoji => (
                              <div key={emoji} onClick={(e) => { e.stopPropagation(); handleAddReaction(msg.id, emoji); }} className="hover:bg-[#404249] p-1 rounded text-xl">{emoji}</div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="p-2 hover:bg-[#404249] cursor-pointer text-[#B5BAC1] hover:text-[#DBDEE1]" onClick={() => setReplyingTo(msg)}>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11 15H13V17H11V15ZM11 7H13V13H11V7ZM12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"/></svg>
                      </div>
                      <div className="p-2 hover:bg-[#404249] cursor-pointer rounded-r-md text-[#B5BAC1] hover:text-[#DBDEE1]">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/></svg>
                      </div>
                    </div>

                    {!isConsecutive || msg.referenced_message ? (
                      <img 
                        src={msg.author.avatar ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png` : "/logo.png"} 
                        className="w-10 h-10 rounded-full shrink-0 mt-0.5 cursor-pointer hover:shadow-lg" 
                        alt="Avatar"
                        onError={(e) => (e.currentTarget.src = "/logo.png")}
                      />
                    ) : (
                      <div className="w-10 shrink-0 text-[10px] text-[#949BA4] flex items-center justify-center opacity-0 group-hover:opacity-100 select-none">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 relative">
                      {/* Replied Message Indicator */}
                      {msg.referenced_message && (
                        <div className="flex items-center gap-2 text-[#B5BAC1] text-xs mb-1 -ml-10 relative">
                          <div className="w-8 h-4 border-l-2 border-t-2 border-[#4E5058] rounded-tl-md ml-4 mr-1 mt-2 shrink-0 opacity-50"></div>
                          <img src={msg.referenced_message.author.avatar ? `https://cdn.discordapp.com/avatars/${msg.referenced_message.author.id}/${msg.referenced_message.author.avatar}.png` : "/logo.png"} className="w-4 h-4 rounded-full" />
                          <span className="font-medium hover:underline cursor-pointer">@{msg.referenced_message.author.username}</span>
                          <span className="truncate flex-1 hover:text-[#DBDEE1] cursor-pointer" onClick={() => document.getElementById(msg.referenced_message?.id || "")?.scrollIntoView({ behavior: 'smooth' })}>{msg.referenced_message.content || 'Attachment'}</span>
                        </div>
                      )}

                      {!isConsecutive || msg.referenced_message ? (
                        <div className="flex items-baseline gap-2 mb-1 leading-tight">
                          <span className="font-medium text-white hover:underline cursor-pointer">{msg.author.username}</span>
                          {msg.author.bot && <span className="bg-[#5865F2] text-white text-[10px] px-1 rounded-[3px] flex items-center font-bold tracking-wide">APP</span>}
                          <span className="text-xs text-[#949BA4]">
                            {new Date(msg.timestamp).toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' })} {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ) : null}
                      {msg.content && <div className="text-[#DBDEE1] leading-relaxed break-words whitespace-pre-wrap">{msg.content}</div>}
                      
                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {msg.attachments.map(att => (
                            <div key={att.id}>
                              {att.content_type?.startsWith('image/') ? (
                                <img src={att.url} alt={att.filename} className="max-w-md max-h-80 rounded-lg cursor-pointer" />
                              ) : (
                                <div className="bg-[#2B2D31] border border-[#1E1F22] rounded p-3 flex items-center gap-3 w-max max-w-full">
                                  <svg className="w-8 h-8 text-[#DBDEE1]" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6C4.89 2 4.01 2.9 4.01 4L4 20C4 21.1 4.89 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20Z"/></svg>
                                  <a href={att.url} target="_blank" className="text-[#00A8FC] hover:underline truncate">{att.filename}</a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Embeds */}
                      {msg.embeds && msg.embeds.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {msg.embeds.map((emb, idx) => (
                            <div key={idx} className="bg-[#2B2D31] border-l-4 rounded max-w-lg p-4" style={{ borderLeftColor: emb.color ? `#${emb.color.toString(16).padStart(6, '0')}` : '#202225' }}>
                              {emb.author && (
                                <div className="flex items-center gap-2 mb-2">
                                  {emb.author.icon_url && <img src={emb.author.icon_url} className="w-6 h-6 rounded-full" />}
                                  <span className="text-sm font-bold text-white">{emb.author.name}</span>
                                </div>
                              )}
                              {emb.title && <div className="font-bold text-[#00A8FC] mb-2">{emb.title}</div>}
                              {emb.description && <div className="text-sm text-[#DBDEE1] whitespace-pre-wrap mb-2">{emb.description}</div>}
                              {emb.image && <img src={emb.image.url} className="max-w-full rounded-lg mt-2" />}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reactions */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {msg.reactions.map((react, rIdx) => (
                            <div key={rIdx} className="bg-[#2B2D31] border border-[#1E1F22] hover:border-[#5865F2] hover:bg-[#3B3D44] cursor-pointer rounded-[4px] px-1.5 py-0.5 flex items-center gap-1.5 transition-colors">
                              <span className="text-[14px]">{react.emoji.id ? <img src={`https://cdn.discordapp.com/emojis/${react.emoji.id}.png`} className="w-4 h-4 inline-block" /> : react.emoji.name}</span>
                              <span className="text-[11px] font-bold text-[#B5BAC1]">{react.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Chat Input Bar / Voice Push-to-Talk */}
        {selectedChannel?.type === 2 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 -mt-20">
            <div className="w-24 h-24 rounded-full bg-[#1E1F22] flex items-center justify-center mb-6 shadow-lg relative">
              <img src="/logo.png" className="w-full h-full object-cover rounded-full" />
              <div className="absolute -bottom-2 -right-2 bg-[#2B2D31] p-1.5 rounded-full border-[3px] border-[#313338]">
                <Icons.Voice />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 text-center">{selectedChannel.name}</h2>
            <p className="text-[#949BA4] text-center max-w-sm">Voice connections through the web dashboard have been disabled.</p>
          </div>
        ) : (
          <div className="px-4 pb-6 pt-0 shrink-0 relative">
            {/* Reply Bar */}
            {replyingTo && (
              <div className="bg-[#2B2D31] rounded-t-lg px-4 py-2 flex items-center justify-between text-sm text-[#B5BAC1]">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Replying to <span className="text-[#DBDEE1]">@{replyingTo.author.username}</span></span>
                </div>
                <svg onClick={() => setReplyingTo(null)} className="w-5 h-5 cursor-pointer hover:text-[#DBDEE1]" fill="currentColor" viewBox="0 0 24 24"><path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" /></svg>
              </div>
            )}

            <form onSubmit={handleSendMessage} className={`bg-[#383A40] flex items-start px-4 py-2.5 ${replyingTo ? 'rounded-b-lg' : 'rounded-lg'}`}>
              <div className="p-1 mr-2 bg-[#B5BAC1] hover:bg-[#DBDEE1] text-[#383A40] rounded-full cursor-pointer flex-shrink-0 transition-colors">
                 <Icons.Plus />
              </div>
              <textarea 
                disabled={!selectedChannel || (selectedChannel.type !== 0 && selectedChannel.type !== 5 && selectedChannel.type !== 1)}
                placeholder={selectedChannel ? `Message ${isDmMode ? '@' + (selectedChannel.recipients?.[0]?.username || '') : '#' + (selectedChannel.name || '')}` : "Select a channel..."}
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e as any);
                  }
                }}
                rows={1}
                className="flex-1 bg-transparent text-[#DBDEE1] outline-none placeholder:text-[#949BA4] resize-none py-[2px] leading-[1.375rem]"
                style={{ minHeight: "24px", maxHeight: "144px" }}
              />
              <div className="flex items-center gap-3 ml-2 shrink-0 h-[24px]">
                <Icons.Gift />
                <Icons.Gif />
                <Icons.Sticker />
                <Icons.Emoji />
              </div>
            </form>
          </div>
        )}
      </div>

      {/* --- RIGHT SIDEBAR: MEMBERS --- */}
      {!isDmMode && selectedGuild && (
        <div className="w-60 bg-[#2B2D31] flex flex-col shrink-0">
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <h3 className="text-[12px] font-bold text-[#949BA4] uppercase mb-1 px-2 mt-4 tracking-wide">
              Server Members — {members.length}
            </h3>
            {members.map(member => (
              <div 
                key={member.user.id}
                onClick={() => handleOpenDmWithUser(member.user.id)}
                className="flex items-center gap-3 px-2 py-[5px] rounded cursor-pointer text-[#949BA4] hover:bg-[#35373C] hover:text-[#DBDEE1] group"
                title="Click to Message"
              >
                <div className="w-8 h-8 rounded-full bg-[#1E1F22] flex items-center justify-center shrink-0 overflow-hidden relative">
                  {member.user.avatar ? (
                    <img src={`https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`} className="w-full h-full object-cover" />
                  ) : (
                    <img src="/logo.png" className="w-full h-full object-cover grayscale opacity-50" />
                  )}
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#23A559] border-[2px] border-[#2B2D31] rounded-full group-hover:border-[#35373C]"></div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-[15px] text-[#DBDEE1] font-medium leading-tight">{member.nick || member.user.username}</span>
                  {member.nick && <span className="truncate text-[12px] text-[#949BA4] leading-tight">{member.user.username}</span>}
                </div>
              </div>
            ))}
            {members.length === 0 && <div className="px-2 text-sm text-[#949BA4]">No members found.</div>}
          </div>
        </div>
      )}

      {/* Global Scrollbar Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #2B2D31; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1A1B1E; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #111214; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  );
}
