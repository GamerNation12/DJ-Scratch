"use client";

const GUILD_ID = "1527127381897383946";
const INVITE = "https://discord.gg/53sxaVWn92";

export default function SupportWidget() {
  return (
    <div className="relative overflow-hidden bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-3xl md:rounded-[2rem] p-6 md:p-10 max-w-3xl w-full hover:border-indigo-500/40 transition-all duration-500">
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="relative z-10 flex flex-col items-center gap-6">
        <iframe
          src={`https://discord.com/widget?id=${GUILD_ID}&theme=dark`}
          width="350"
          height="450"
          frameBorder="0"
          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
          title="DJ Scratch Support server"
          className="rounded-2xl max-w-full"
        />
        <a
          href={INVITE}
          target="_blank"
          rel="noreferrer"
          className="px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-xl text-sm transition-all duration-300 shadow-lg shadow-[#5865F2]/20"
        >
          Join Server
        </a>
      </div>
    </div>
  );
}
