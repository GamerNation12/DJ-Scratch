"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { artSrc } from "@/lib/art";

type Props = { params: Promise<{ username: string }> };

type Slide = {
  eyebrow: string;
  title: string;
  subtitle: string;
  image?: string | null;
  gradient: string;
};

export default function WrappedPage({ params }: Props) {
  const { username } = use(params);
  const key = decodeURIComponent(username || "");
  const [loading, setLoading] = useState(true);
  const [recap, setRecap] = useState<any>(null);
  const [rhythm, setRhythm] = useState<any>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch(`/api/recap?user=${encodeURIComponent(key)}&period=month`).then((r) => r.json().catch(() => null)),
          fetch(`/api/u/${encodeURIComponent(key)}?period=1month`).then((r) => r.json().catch(() => null)),
        ]);
        if (!cancelled) {
          setRecap(r1 && !r1.error ? r1 : null);
          setRhythm((r2 as any)?.rhythm || (r2 as any)?.stats?.rhythm || null);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [key]);

  const slides: Slide[] = useMemo(() => {
    const out: Slide[] = [];
    const total = Number(recap?.total || 0);
    const topArtist = (recap?.topArtists || [])[0];
    const topTrack = (recap?.topTracks || [])[0];
    const topAlbum = (recap?.topAlbums || [])[0];
    const minutes = Math.floor(Number(rhythm?.minutesTotalMs || 0) / 60000);
    const timeStr = minutes >= 1440 ? `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
      : minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
    const genre = (rhythm?.genres || [])[0];
    const discoveries: string[] = Array.isArray(rhythm?.discoveries) ? rhythm.discoveries.filter(Boolean) : [];
    out.push({
      eyebrow: recap?.label || "Last 30 days",
      title: total.toLocaleString(),
      subtitle: "plays this month",
      gradient: "from-indigo-600 via-purple-600 to-fuchsia-600",
    });
    if (topArtist) out.push({
      eyebrow: "Top artist",
      title: topArtist.name,
      subtitle: `${Number(topArtist.playcount || 0).toLocaleString()} plays`,
      image: topArtist.image || null,
      gradient: "from-fuchsia-600 via-pink-600 to-rose-600",
    });
    if (topTrack) out.push({
      eyebrow: "Top track",
      title: topTrack.name,
      subtitle: `${topTrack.artist} • ${Number(topTrack.playcount || 0).toLocaleString()} plays`,
      image: topTrack.image || null,
      gradient: "from-cyan-600 via-sky-600 to-indigo-600",
    });
    if (topAlbum) out.push({
      eyebrow: "Top album",
      title: topAlbum.name,
      subtitle: `${topAlbum.artist} • ${Number(topAlbum.playcount || 0).toLocaleString()} plays`,
      image: topAlbum.image || null,
      gradient: "from-amber-600 via-orange-600 to-red-600",
    });
    if (minutes > 0) out.push({
      eyebrow: "Listening time",
      title: timeStr,
      subtitle: "of music this month",
      gradient: "from-emerald-600 via-teal-600 to-cyan-600",
    });
    if (genre) out.push({
      eyebrow: "Top genre",
      title: genre.name,
      subtitle: `${Number(genre.count || 0).toLocaleString()} hits`,
      gradient: "from-violet-600 via-purple-600 to-indigo-600",
    });
    if (discoveries.length > 0) out.push({
      eyebrow: "New discoveries",
      title: discoveries.slice(0, 3).join(" • "),
      subtitle: `${discoveries.length} new artist${discoveries.length === 1 ? "" : "s"} this month`,
      gradient: "from-yellow-600 via-amber-600 to-orange-600",
    });
    return out;
  }, [recap, rhythm]);

  // Auto-advance like a story.
  useEffect(() => {
    if (slides.length < 2) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % slides.length), 4500);
    return () => clearTimeout(id);
  }, [index, slides.length]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e0618]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (slides.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0e0618] text-white gap-4 p-6 text-center">
        <div className="text-xl font-bold">No Wrapped yet</div>
        <div className="text-zinc-400 text-sm">Listen to something this month and check back.</div>
        <Link href={`/${encodeURIComponent(key)}`} className="text-indigo-300 text-sm font-bold">← Back to profile</Link>
      </div>
    );
  }
  const s = slides[index % slides.length];

  return (
    <div className={`min-h-screen bg-gradient-to-br ${s.gradient} text-white flex flex-col items-center justify-center p-6 relative overflow-hidden`}>
      <div className="absolute top-0 inset-x-0 p-4 flex gap-1.5 max-w-md w-full">
        {slides.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
            {i < index % slides.length && <div className="h-full w-full bg-white" />}
            {i === index % slides.length && (
              <div key={index} className="h-full bg-white animate-[wrappedfill_4.5s_linear_forwards]" />
            )}
          </div>
        ))}
      </div>
      <style>{`@keyframes wrappedfill { from { width: 0% } to { width: 100% } }`}</style>

      <button onClick={() => setIndex((index - 1 + slides.length) % slides.length)}
        className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 text-xl" aria-label="Previous">‹</button>
      <button onClick={() => setIndex((index + 1) % slides.length)}
        className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 text-xl" aria-label="Next">›</button>

      <div key={index} className="text-center max-w-lg animate-fade-in">
        <div className="text-xs font-black uppercase tracking-[0.3em] text-white/70 mb-4">{s.eyebrow}</div>
        {s.image && (
          <img src={artSrc(s.image)} alt="" className="w-40 h-40 rounded-3xl object-cover mx-auto mb-6 shadow-2xl" />
        )}
        <div className="text-4xl sm:text-5xl font-display font-black tracking-tight leading-tight mb-3">{s.title}</div>
        <div className="text-white/80 font-medium">{s.subtitle}</div>
      </div>

      <div className="absolute bottom-6 flex items-center gap-4 text-sm font-bold">
        <Link href={`/${encodeURIComponent(key)}`} className="px-4 py-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors">
          ← {key}
        </Link>
        <span className="text-white/60">{(index % slides.length) + 1} / {slides.length}</span>
      </div>
    </div>
  );
}
