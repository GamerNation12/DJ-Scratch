import Link from "next/link";
import AdsterraBanner from "@/components/AdsterraBanner";

// Server-rendered so search engines see real download links/content instead of
// a client-side loading spinner (which Google classified as a soft 404).
// Cached hourly; the GitHub token is optional but avoids the 60/hr limit.
export const revalidate = 3600;

type ReleaseAsset = {
  name: string;
  size: number;
  browser_download_url: string;
};

type Release = {
  id: number;
  name?: string;
  tag_name: string;
  published_at: string;
  body?: string;
  prerelease?: boolean;
  assets: ReleaseAsset[];
};

const RELEASES_URL = "https://github.com/GamerNation12/DJ-Scratch/releases";

async function getReleases(): Promise<Release[]> {
  try {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetch(
      "https://api.github.com/repos/GamerNation12/DJ-Scratch/releases",
      { headers, next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function PlatformLinks({ release }: { release?: Release }) {
  const exe = release?.assets.find((a) => a.name.endsWith(".exe"));
  const apk = release?.assets.find((a) => a.name.endsWith(".apk"));
  const linux =
    release?.assets.find((a) => a.name.endsWith(".AppImage")) ||
    release?.assets.find((a) => a.name.endsWith(".deb"));

  const rows = [
    {
      label: "Windows",
      detail: exe ? `.exe • ${(exe.size / 1024 / 1024).toFixed(1)} MB` : "Installer on GitHub",
      href: exe?.browser_download_url || RELEASES_URL,
      className: "bg-indigo-500 hover:bg-indigo-400",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
      ),
    },
    {
      label: "Android",
      detail: apk ? `.apk • ${(apk.size / 1024 / 1024).toFixed(1)} MB` : "APK on GitHub",
      href: apk?.browser_download_url || RELEASES_URL,
      className: "bg-emerald-500 hover:bg-emerald-400",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
      ),
    },
    {
      label: "Linux",
      detail: linux
        ? `${linux.name.endsWith(".deb") ? ".deb" : ".AppImage"} • ${(linux.size / 1024 / 1024).toFixed(1)} MB`
        : "AppImage on GitHub",
      href: linux?.browser_download_url || RELEASES_URL,
      className: "bg-amber-500 hover:bg-amber-400",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
      ),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {rows.map((row) => (
        <a
          key={row.label}
          href={row.href}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center gap-4 ${row.className} transition-colors p-4 rounded-2xl`}
        >
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            {row.icon}
          </div>
          <div>
            <div className="font-bold text-white leading-tight">{row.label}</div>
            <div className="text-xs text-white/80 mt-1">{row.detail}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

export default async function DownloadPage() {
  const releases = await getReleases();
  const latest = releases[0];

  return (
    <div className="min-h-screen bg-[#0e0618] text-white font-sans selection:bg-indigo-500/30 overflow-hidden relative flex flex-col items-center">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 flex justify-center items-center opacity-30">
        <div className="absolute w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-blob"></div>
        <div className="absolute w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] mix-blend-screen animate-blob animation-delay-200"></div>
      </div>
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] pointer-events-none z-0 mix-blend-overlay"></div>

      <main className="relative z-10 w-full max-w-5xl mx-auto px-4 pt-24 pb-24">
        <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-12 font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg> Back to Home
        </Link>

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-6 shadow-[0_0_30px_rgba(99,102,241,0.15)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">
            Download DJ Scratch
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto font-medium">
            Get the ultimate Last.fm and Spotify stats experience on Windows, Linux and Android.
          </p>
        </div>

        <section className="bg-[#170b28]/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 md:p-8 mb-10">
          <h2 className="text-2xl font-display font-extrabold mb-4">
            {latest ? `Latest version${latest.name ? `: ${latest.name}` : ""}` : "Get the latest build"}
          </h2>
          <PlatformLinks release={latest} />
          <p className="text-xs text-zinc-500 mt-4">
            {latest?.published_at
              ? `Published ${new Date(latest.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}. `
              : ""}
            Every download is also available on{" "}
            <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200 font-semibold">
              GitHub Releases
            </a>.
          </p>
        </section>

        <div className="flex justify-center mb-14">
          <AdsterraBanner
            adKey="ec34d3dbfeac486d6db49b4371486d11"
            width={300}
            height={250}
          />
        </div>

        {releases.length > 1 && (
          <section className="mb-14">
            <h2 className="text-xl font-display font-extrabold mb-4">Previous releases</h2>
            <div className="space-y-4">
              {releases.slice(1).map((release) => (
                <div key={release.id} className="bg-[#170b28]/40 backdrop-blur-md border border-white/10 rounded-2xl p-5">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h3 className="text-lg font-bold text-white">{release.name || release.tag_name}</h3>
                    {release.prerelease && (
                      <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-display font-black uppercase tracking-widest rounded-full border border-amber-500/30">Beta</span>
                    )}
                    <span className="text-xs text-zinc-500">
                      {new Date(release.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </span>
                  </div>
                  <PlatformLinks release={release} />
                </div>
              ))}
            </div>
          </section>
        )}

        {latest?.body && (
          <section className="mb-14">
            <h2 className="text-xl font-display font-extrabold mb-4">Release notes</h2>
            <div className="whitespace-pre-wrap text-zinc-300 font-medium leading-relaxed bg-[#170b28]/50 p-6 rounded-2xl border border-white/5">
              {latest.body}
            </div>
          </section>
        )}

        <section className="grid gap-6 md:grid-cols-2 mb-14">
          <div className="bg-[#170b28]/40 backdrop-blur-md border border-white/10 rounded-3xl p-6">
            <h2 className="text-xl font-display font-extrabold mb-3">What you get</h2>
            <ul className="space-y-2 text-zinc-400 text-sm leading-relaxed">
              <li>• Your Last.fm and Spotify listening stats in one place</li>
              <li>• Now playing, top artists, albums and tracks</li>
              <li>• Weekly and monthly recaps plus shareable music cards</li>
              <li>• Crowns, streaks and server leaderboards</li>
              <li>• Private mode and imported listening history</li>
            </ul>
          </div>
          <div className="bg-[#170b28]/40 backdrop-blur-md border border-white/10 rounded-3xl p-6">
            <h2 className="text-xl font-display font-extrabold mb-3">How to install</h2>
            <ol className="space-y-2 text-zinc-400 text-sm leading-relaxed list-decimal list-inside">
              <li>Download the build for your platform above.</li>
              <li>Windows: run the <span className="text-zinc-200 font-semibold">.exe</span>. If SmartScreen appears, choose More info → Run anyway.</li>
              <li>Android: open the <span className="text-zinc-200 font-semibold">.apk</span> and allow installs from your browser when prompted.</li>
              <li>Linux: make the AppImage executable (<span className="text-zinc-200 font-semibold">chmod +x</span>) and run it.</li>
              <li>Open the app and log in with Discord to load your stats.</li>
            </ol>
          </div>
        </section>

        <p className="text-center text-zinc-500 text-sm">
          Prefer the browser? Use the{" "}
          <Link href="/" className="text-indigo-300 hover:text-indigo-200 font-semibold">web dashboard</Link>,{" "}
          <Link href="/leaderboard" className="text-indigo-300 hover:text-indigo-200 font-semibold">global leaderboards</Link> or the{" "}
          <Link href="/tools" className="text-indigo-300 hover:text-indigo-200 font-semibold">free stats tools</Link>.
        </p>
      </main>
    </div>
  );
}
