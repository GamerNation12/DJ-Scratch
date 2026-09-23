"use client";

const GUILD_ID = "1527127381897383946";
const INVITE = "https://discord.gg/53sxaVWn92";

const PERKS = [
  { emoji: "🛟", title: "Fast support", desc: "Help from the team and community." },
  { emoji: "💡", title: "Suggestions", desc: "Shape what gets built next." },
  { emoji: "🐛", title: "Bug reports", desc: "Report issues where they're seen." },
  { emoji: "📣", title: "Update news", desc: "Hear about features first." },
];

export default function SupportWidget() {
  return (
    <div className="relative overflow-hidden bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-3xl md:rounded-[2rem] p-6 md:p-10 max-w-5xl w-full hover:border-indigo-500/40 transition-all duration-500">
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="relative z-10 grid md:grid-cols-2 gap-8 md:gap-10 items-center">
        <div>
          <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2">
            Hangout with people who get it
          </h3>
          <p className="text-zinc-400 font-medium mb-6 leading-relaxed">
            Music nerds, bot updates, and help when you need it.
          </p>
          <ul className="space-y-4 mb-8">
            {PERKS.map((p) => (
              <li key={p.title} className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg shrink-0">
                  {p.emoji}
                </span>
                <span>
                  <span className="block text-white font-semibold text-sm">{p.title}</span>
                  <span className="block text-zinc-500 text-sm">{p.desc}</span>
                </span>
              </li>
            ))}
          </ul>
          <a
            href={INVITE}
            target="_blank"
            rel="noreferrer"
            className="inline-flex px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-xl text-sm transition-all duration-300 shadow-lg shadow-[#5865F2]/20"
          >
            Join Server
          </a>
        </div>
        <div className="flex justify-center md:justify-end">
          <div className="rounded-2xl p-[1px] bg-gradient-to-b from-indigo-500/50 via-white/10 to-emerald-500/30 shadow-2xl shadow-indigo-500/20">
            <iframe
              src={`https://discord.com/widget?id=${GUILD_ID}&theme=dark`}
              width="340"
              height="460"
              frameBorder="0"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
              title="DJ Scratch Support server"
              className="rounded-2xl max-w-full block"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
