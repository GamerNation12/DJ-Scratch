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
          if (cmd === ",cd") {
            setSandboxMessages(prev => [...prev, { 
              role: 'bot', 
              isCD: true,
              embed: { thumbnail: data.track.image, title: data.track.name, description: data.track.artist }
            }]);
          } else {
            setSandboxMessages(prev => [...prev, { 
              role: 'bot', 
              embed: {
                title: "Now Playing",
                description: `**${data.track.name}**\nby ${data.track.artist}\non *${data.track.album}*`,
                thumbnail: data.track.image
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
          
          <div className="bg-[#1e1f22] rounded-lg overflow-hidden border border-white/5 flex flex-col h-[300px]">
            <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-4">
              {sandboxMessages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-500' : 'bg-red-500'}`}>
                    {msg.role === 'user' ? <MessageSquare className="w-4 h-4 text-white" /> : <Music className="w-4 h-4 text-white" />}
                  </div>
                  <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs font-bold text-zinc-400 mb-1">{msg.role === 'user' ? 'You' : 'DJ Scratch'}</span>
                    {msg.text && (
                      <div className={`px-4 py-2 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-500 text-white rounded-tr-sm' : 'bg-[#2b2d31] border border-white/5 text-white rounded-tl-sm'}`}>
                        {msg.text}
                      </div>
                    )}
                    {msg.isCD ? (
                      <div className="mt-1 flex flex-col items-center">
                        <div className="relative w-32 h-32 rounded-full border-4 border-zinc-800 shadow-xl overflow-hidden animate-[spin_4s_linear_infinite]">
                          {msg.embed.thumbnail && (
                            <img src={msg.embed.thumbnail} alt="cd cover" className="absolute inset-0 w-full h-full object-cover" />
                          )}
                          <div className="absolute inset-0 bg-black/10 rounded-full pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"></div>
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-zinc-900 rounded-full border-2 border-zinc-700 shadow-inner"></div>
                        </div>
                        <div className="mt-2 text-xs font-bold text-white bg-black/50 px-2 py-1 rounded">{msg.embed.title}</div>
                      </div>
                    ) : msg.embed ? (
                      <div className="bg-[#2b2d31] border-l-4 border-indigo-500 rounded-r-lg p-3 mt-1 flex gap-4 w-full max-w-sm border border-y-white/5 border-r-white/5 shadow-md">
                        <div className="flex-1 flex flex-col justify-center">
                          <span className="text-xs font-bold text-zinc-400 mb-1">{msg.embed.title}</span>
                          <span className="text-sm text-white mb-1"><ReactMarkdown>{msg.embed.description}</ReactMarkdown></span>
                        </div>
                        {msg.embed.thumbnail && (
                          <img src={msg.embed.thumbnail} alt="cover" className="w-16 h-16 rounded-md object-cover flex-shrink-0 shadow-sm" />
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-red-500">
                    <Music className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-[#2b2d31] px-4 py-2 rounded-2xl rounded-tl-sm border border-white/5 text-zinc-400">
                    <span className="animate-pulse">DJ Scratch is thinking...</span>
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
