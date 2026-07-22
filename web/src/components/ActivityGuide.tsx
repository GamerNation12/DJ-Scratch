"use client";

import { Info, Music, MessageSquare, Settings, Command, Activity, Zap, CheckCircle, Send } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";

export default function ActivityGuide({ onComplete }: { onComplete?: () => void }) {
  const [sandboxInput, setSandboxInput] = useState("");
  const [sandboxMessages, setSandboxMessages] = useState<{role: 'user'|'bot', text?: string, embed?: any, isCD?: boolean}[]>([
    { role: 'bot', text: "Welcome to the sandbox! Try typing `,fm` or `,cd` to see what the bot does." }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [userInfo, setUserInfo] = useState({ name: 'You', avatar: '' });

  useEffect(() => {
    const token = localStorage.getItem("discord_jwt");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserInfo({
          name: payload.global_name || payload.username || 'You',
          avatar: payload.avatar ? `https://cdn.discordapp.com/avatars/${payload.id}/${payload.avatar}.png` : ''
        });
      } catch(e) {}
    }
  }, []);

  const [userInfo, setUserInfo] = useState({ name: 'You', avatar: '' });

  useEffect(() => {
    const token = localStorage.getItem("discord_jwt");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserInfo({
          name: payload.global_name || payload.username || 'You',
          avatar: payload.avatar ? `https://cdn.discordapp.com/avatars/${payload.id}/${payload.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'
        });
      } catch(e) {}
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sandboxMessages]);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxInput.trim()) return;
    
    const cmd = sandboxInput.trim().toLowerCase();
    setSandboxMessages(prev => [...prev, { role: 'user', text: cmd }]);
    setSandboxInput("");
    setIsLoading(true);

    if (cmd === ",fm" || cmd === ",cd") {
      try {
        const token = localStorage.getItem("discord_jwt");
        const res = await fetch("/api/now-playing", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.error === "not_linked") {
          setSandboxMessages(prev => [...prev, { role: 'bot', text: "❌ You need to link your Last.fm account first! Use `,lfm set <username>`." }]);
        } else if (data.playing && data.track) {
          const imgUrl = data.track.image ? data.track.image.replace("http://", "https://") : "";
          if (cmd === ",cd") {
            setSandboxMessages(prev => [...prev, { 
              role: 'bot', 
              isCD: true,
              embed: { thumbnail: imgUrl, trackName: data.track.name, artist: data.track.artist, album: data.track.album }
            }]);
          } else {
            setSandboxMessages(prev => [...prev, { 
              role: 'bot', 
              embed: {
                trackName: data.track.name,
                artist: data.track.artist,
                album: data.track.album,
                thumbnail: imgUrl
              }
            }]);
          }
        } else {
          setSandboxMessages(prev => [...prev, { role: 'bot', text: "You are not currently listening to anything on Last.fm (or your account is private)." }]);
        }
      } catch (err) {
        setSandboxMessages(prev => [...prev, { role: 'bot', text: "Error fetching Last.fm data." }]);
      }
    } else if (cmd.startsWith(",lfm set ")) {
      setSandboxMessages(prev => [...prev, { role: 'bot', text: "✅ In the real bot, this would link your Last.fm account! (You can do this in the Settings tab here too)." }]);
    } else {
      setSandboxMessages(prev => [...prev, { role: 'bot', text: "I only understand `,fm`, `,cd`, and `,lfm set` in this sandbox! Try `,cd`!" }]);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#313338] text-[#dbdee1] overflow-y-auto custom-scrollbar relative z-10">
      {/* Header */}
      <div className="p-6 border-b border-[#1e1f22] bg-[#2b2d31]">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <Activity className="w-8 h-8 text-indigo-400" />
          Welcome to DJ Scratch Activity!
        </h1>
        <p className="text-[#b5bac1] text-sm">
          This is the Discord Activity version of DJ Scratch, where you can easily chat, manage friends, and flex your music taste right from Discord DMs.
        </p>
      </div>

      <div className="p-6 max-w-4xl mx-auto space-y-8 w-full pb-20">
        
        <section className="bg-[#2b2d31] border border-[#1e1f22] rounded-xl p-5 shadow-sm">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Interactive Sandbox
          </h2>
          <div className="space-y-4 text-sm text-[#b5bac1] mb-4">
            <p>Try testing out the bot right here! Type <strong>,fm</strong> or <strong>,cd</strong> below to see your real currently playing song.</p>
          </div>
          
          <div className="bg-[#313338] rounded-lg overflow-hidden border border-white/5 flex flex-col h-[350px]">
            <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-4">
              {sandboxMessages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 w-full`}>
                  <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden bg-zinc-700">
                    {msg.role === 'user' ? (
                      userInfo.avatar ? <img src={userInfo.avatar} alt="user" className="w-full h-full object-cover" /> : <MessageSquare className="w-5 h-5 text-white" />
                    ) : (
                      <img src="/icon.png" alt="bot" className="w-full h-full object-cover bg-[#2b2d31]" />
                    )}
                  </div>
                  <div className={`flex flex-col flex-1 w-full`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-[15px] font-medium text-[#f2f3f5]">{msg.role === 'user' ? userInfo.name : 'DJ Scratch'}</span>
                      {msg.role === 'bot' && <span className="bg-[#5865f2] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-[3px] flex items-center gap-1 leading-none h-[15px]"><CheckCircle className="w-2.5 h-2.5" /> BOT</span>}
                      <span className="text-xs text-[#949ba4] font-medium">Today at {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    {msg.text && (
                      <div className="text-[15px] text-[#dbdee1] leading-relaxed">
                        {msg.text}
                      </div>
                    )}
                    {msg.isCD ? (
                      <div className="mt-2 flex flex-col items-center max-w-sm">
                        <div className="relative w-32 h-32 rounded-full border-4 border-zinc-800 shadow-xl overflow-hidden animate-[spin_4s_linear_infinite]">
                          {msg.embed.thumbnail && (
                            <img src={msg.embed.thumbnail} alt="cd cover" className="absolute inset-0 w-full h-full object-cover" />
                          )}
                          <div className="absolute inset-0 bg-black/10 rounded-full pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"></div>
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-zinc-900 rounded-full border-2 border-zinc-700 shadow-inner"></div>
                        </div>
                        <div className="mt-2 text-xs font-bold text-white bg-black/50 px-2 py-1 rounded">{msg.embed.trackName}</div>
                      </div>
                    ) : msg.embed ? (
                      <div className="bg-[#2b2d31] rounded-[4px] p-3 mt-2 flex gap-4 w-full max-w-[432px] border-l-4 border-l-[#e82a32]">
                        <div className="flex-1 flex flex-col">
                          <div className="flex items-center gap-2 mb-2">
                             <img src={userInfo.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'} className="w-6 h-6 rounded-full object-cover" />
                             <span className="text-[14px] font-semibold text-white">{userInfo.name}&apos;s Now Playing</span>
                          </div>
                          <div className="text-[14px] text-[#dbdee1] leading-snug">
                            <strong className="text-[#00a8fc] hover:underline cursor-pointer">{msg.embed.trackName}</strong><br />
                            by <strong>{msg.embed.artist}</strong><br />
                            <em>{msg.embed.album}</em>
                          </div>
                        </div>
                        {msg.embed.thumbnail && (
                          <img src={msg.embed.thumbnail} alt="cover" className="w-[80px] h-[80px] rounded-[4px] object-cover flex-shrink-0" />
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden bg-[#2b2d31]">
                    <img src="/icon.png" alt="bot" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="text-[15px] font-bold text-[#f2f3f5] mb-1 flex items-center gap-2">
                      DJ Scratch <span className="bg-[#5865f2] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-[3px] flex items-center gap-1"><CheckCircle className="w-2.5 h-2.5" /> BOT</span>
                    </span>
                    <span className="text-[14px] text-zinc-400 animate-pulse">DJ Scratch is typing...</span>
                  </div>
                </div>
              )}
            </div>
            
            <form onSubmit={handleCommand} className="p-3 bg-[#2b2d31] border-t border-white/5 flex gap-2">
              <input 
                type="text" 
                value={sandboxInput}
                onChange={(e) => setSandboxInput(e.target.value)}
                placeholder="Type a command like ,fm..."
                className="flex-1 bg-[#1e1f22] text-white px-4 py-2 rounded-lg outline-none border border-transparent focus:border-indigo-500 transition-colors"
              />
              <button type="submit" disabled={!sandboxInput.trim() || isLoading} className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white w-10 h-10 rounded-lg flex items-center justify-center transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>

        {/* Existing Content */}
        <section className="bg-[#2b2d31] border border-[#1e1f22] rounded-xl p-5 shadow-sm">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Music className="w-5 h-5 text-emerald-400" />
            Bot Avatar Feature 🖼️
          </h2>
          <div className="space-y-4 text-sm text-[#b5bac1]">
            <p>
              When you run the <span className="font-mono bg-[#1e1f22] px-1 py-0.5 rounded text-white">,fm</span> command in Discord, the bot generates an embed of your song. 
              Clicking the <strong>Preview Avatar</strong> button will show you what the bot would look like if it stole your album cover. Clicking <strong>Set as Bot Avatar</strong> updates the bot's global profile picture instantly!
            </p>
          </div>
        </section>

        <section className="bg-[#2b2d31] border border-[#1e1f22] rounded-xl p-5 shadow-sm">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            Chat & Friends
          </h2>
          <div className="space-y-4 text-sm text-[#b5bac1]">
            <p>
              The <strong>Messages</strong> tab inside this Activity allows you to chat securely with your friends using DJ Scratch.
              Click the <strong>Friends</strong> button to send or accept friend requests using Discord User IDs.
            </p>
          </div>
        </section>

        {onComplete && (
          <div className="flex justify-center pt-6 border-t border-white/5">
            <button 
              onClick={onComplete}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5"
            >
              <CheckCircle className="w-5 h-5" />
              Finish Onboarding
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
