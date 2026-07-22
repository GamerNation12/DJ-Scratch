"use client";

import { Info, Music, MessageSquare, Settings, Command, Activity, Zap } from "lucide-react";

export default function ActivityGuide() {
  return (
    <div className="flex-1 flex flex-col h-full bg-[#313338] text-[#dbdee1] overflow-y-auto">
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
        
        {/* Getting Started */}
        <section className="bg-[#2b2d31] border border-[#1e1f22] rounded-xl p-5 shadow-sm">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Getting Started
          </h2>
          <div className="space-y-4 text-sm text-[#b5bac1]">
            <p>
              To get the most out of DJ Scratch, you'll need to link your Last.fm account.
            </p>
            <div className="bg-[#1e1f22] p-3 rounded-lg border border-white/5 font-mono text-indigo-300">
              ,lfm set &lt;your_lastfm_username&gt;
            </div>
            <p>
              Run this command in any server where DJ Scratch is present, or send it to the bot in DMs if the bot allows it.
            </p>
          </div>
        </section>

        {/* Music & Avatars */}
        <section className="bg-[#2b2d31] border border-[#1e1f22] rounded-xl p-5 shadow-sm">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Music className="w-5 h-5 text-emerald-400" />
            Flexing Your Music
          </h2>
          <div className="space-y-4 text-sm text-[#b5bac1]">
            <p>
              Once your account is linked, you can display what you are currently listening to using:
            </p>
            <div className="bg-[#1e1f22] p-3 rounded-lg border border-white/5 font-mono text-emerald-300">
              ,fm
            </div>
            <h3 className="text-white font-semibold mt-4 mb-2">Bot Avatar Feature 🖼️</h3>
            <p>
              When you run the <span className="font-mono bg-[#1e1f22] px-1 py-0.5 rounded text-white">,fm</span> command, the bot generates an embed of your song. 
              Clicking the <strong>Preview Avatar</strong> button will show you what the bot would look like if it stole your album cover. Clicking <strong>Set as Bot Avatar</strong> updates the bot's global profile picture instantly!
            </p>
            <p className="text-xs opacity-75 mt-2">
              Note: The avatar command has a short global cooldown to prevent abuse.
            </p>
          </div>
        </section>

        {/* Chatting */}
        <section className="bg-[#2b2d31] border border-[#1e1f22] rounded-xl p-5 shadow-sm">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            Chat & Friends
          </h2>
          <div className="space-y-4 text-sm text-[#b5bac1]">
            <p>
              The <strong>Messages</strong> tab inside this Activity allows you to chat securely with your friends using DJ Scratch.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Navigate to the Messages tab using the sidebar menu.</li>
              <li>Click the <strong>Friends</strong> button to send or accept friend requests using Discord User IDs.</li>
              <li>Once accepted, you can instantly message each other, send GIFs, emojis, and share files!</li>
            </ul>
          </div>
        </section>

        {/* Activity Settings */}
        <section className="bg-[#2b2d31] border border-[#1e1f22] rounded-xl p-5 shadow-sm">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-zinc-400" />
            Customizing the Activity
          </h2>
          <div className="space-y-4 text-sm text-[#b5bac1]">
            <p>
              Don't want to see this guide every time you open the Activity?
            </p>
            <p>
              Head over to the <strong>Settings</strong> tab, scroll down to <strong>Activity Preferences</strong>, and set your <strong>Default Startup Page</strong>. The Activity will automatically remember your choice next time you open it!
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
