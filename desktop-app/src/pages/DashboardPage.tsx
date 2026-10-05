import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { CalendarDays, Clock, Disc3, Sparkles } from 'lucide-react';
import { API_BASE, PERIODS, POLL_MS, type Period } from '../lib/config';
import { api } from '../lib/api';
import type { RhythmData, UserStats } from '../lib/types';
import { Card, Empty, ErrorBox, SectionTitle, Spinner } from '../components/ui';

function mergeStats(data: { stats?: UserStats | null; rhythm?: RhythmData | null }): UserStats {
  const stats = { ...(data.stats || {}) } as UserStats;
  const topRhythm = data.rhythm ?? stats.rhythm ?? null;
  if (topRhythm) stats.rhythm = topRhythm;
  return stats;
}

export default function DashboardPage({ token, username }: { token: string | null; username: string }) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [period, setPeriod] = useState<Period>('overall');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recap, setRecap] = useState<Record<string, any> | null>(null);
  const [recapPeriod, setRecapPeriod] = useState<'week' | 'month'>('week');
  const [recapLoading, setRecapLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0); // re-renders the "updated Xs ago" label
  const periodRef = useRef(period);
  periodRef.current = period;

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getProfile(username, token, periodRef.current);
      setStats(mergeStats(data));
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  // Silent background refresh: keeps recents live without flashing a spinner.
  // Skipped while the tab is hidden or when the user disabled auto-refresh.
  const quietLoad = async () => {
    if (!token || document.hidden) return;
    if (localStorage.getItem('ds_polling') === 'off') return;
    try {
      const data = await api.getProfile(username, token, periodRef.current);
      setStats(mergeStats(data));
      setError('');
      setUpdatedAt(Date.now());
    } catch {
      // Keep showing last good data; the App shell shows the offline state.
    }
  };
  const quietRef = useRef(quietLoad);
  quietRef.current = quietLoad;

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    setRecapLoading(true);
    (async () => {
      try {
        const data = await api.getRecap(username, token, recapPeriod);
        if (!cancelled) setRecap(data as Record<string, any>);
      } catch {
        if (!cancelled) setRecap(null);
      } finally {
        if (!cancelled) setRecapLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recapPeriod, username]);

  useEffect(() => {
    const id = setInterval(() => quietRef.current(), POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const updatedAgo = updatedAt == null ? '' : (() => {
    const s = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
    void tick;
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  })();

  const recents = (stats?.recentTracks || []).filter(
    (t) => !query || `${t.name} ${t.artist}`.toLowerCase().includes(query.toLowerCase())
  );

  const insights = (() => {
    const all = stats?.recentTracks || [];
    const now = Date.now();
    const plays24h = all.filter((t) => {
      const uts = Number(t.date || 0);
      return !t.nowPlaying && uts > 0 && now - uts * 1000 < 24 * 60 * 60 * 1000;
    }).length;
    const uniqueArtists = new Set(all.map((t) => (t.artist || '').toLowerCase()).filter(Boolean)).size;
    const topArtist = stats?.topArtists?.[0] || null;
    const total = Number(stats?.playcount || 0);
    const share = topArtist && total > 0 ? Math.min(100, (Number(topArtist.playcount || 0) / total) * 100) : 0;
    const next = total < 10 ? 10 : Math.pow(10, Math.ceil(Math.log10(total + 1)));
    return { plays24h, uniqueArtists, topArtist, total, share, next, pct: Math.min(100, (total / next) * 100) };
  })();

  const rhythm = stats?.rhythm ?? null;
  const clock: number[] = Array.from({ length: 24 }, (_, i) => {
    const v = Array.isArray(rhythm?.clock) ? Number(rhythm?.clock?.[i] || 0) : 0;
    return Number.isFinite(v) && v > 0 ? v : 0;
  });
  const clockMax = Math.max(0, ...clock);
  const hasClock = clockMax > 0;

  const daily = (Array.isArray(rhythm?.daily) ? rhythm.daily : [])
    .filter((d) => d && typeof d.date === 'string' && d.date.length > 0)
    .slice(-14)
    .map((d) => ({ date: d.date, plays: Number(d.plays || 0) > 0 ? Number(d.plays) : 0 }));
  const dailyMax = daily.reduce((m, d) => Math.max(m, d.plays), 0);
  const hasDaily = dailyMax > 0;

  const streak = Number(rhythm?.streak || 0) > 0 ? Number(rhythm?.streak) : 0;
  const longestStreak = Number(rhythm?.longestStreak || 0) > 0 ? Number(rhythm?.longestStreak) : 0;
  const avgPerDay = Number(rhythm?.avgPerDay || 0) > 0 ? Number(rhythm?.avgPerDay) : 0;
  const showStrip = streak > 0 || avgPerDay > 0;

  const genres = (Array.isArray(rhythm?.genres) ? rhythm.genres : [])
    .filter((g) => g && typeof g.name === 'string' && g.name.trim().length > 0 && Number(g.count || 0) > 0)
    .map((g) => ({ name: g.name.trim(), count: Number(g.count) }))
    .slice(0, 6);
  const genreMax = genres.reduce((m, g) => Math.max(m, g.count), 0);
  const hasGenres = genres.length > 0 && genreMax > 0;

  const discoveries = (Array.isArray(rhythm?.discoveries) ? rhythm.discoveries : [])
    .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
    .map((d) => d.trim())
    .slice(0, 8);
  const hasDiscoveries = discoveries.length > 0;

  return (
    <div className="animate-fade-in max-w-5xl mx-auto pb-28">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <h1 className="text-4xl font-black tracking-tight">
          Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">{username}</span>
        </h1>
        <div className="flex gap-2 items-center">
          {updatedAgo && <span className="text-xs text-zinc-500 font-semibold mr-1">Updated {updatedAgo} · auto</span>}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold"
            title="Top stats period"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <button onClick={load} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-bold">
            Refresh
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${API_BASE}/${encodeURIComponent(username)}`);
                toast.success('Profile link copied!');
              } catch {
                toast.error('Could not copy link.');
              }
            }}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-bold"
            title="Copy your public profile link"
          >
            Share
          </button>
        </div>
      </div>

      {loading && <Spinner label="Loading your stats…" />}
      {error && <ErrorBox message={error} onRetry={load} />}

      {!loading && !error && stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
            <Card className="p-7">
              <div className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Total scrobbles</div>
              <div className="text-4xl font-black">{Number(stats.playcount || 0).toLocaleString()}</div>
            </Card>
            <Card className="p-7">
              <div className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Top artist ({period})</div>
              <div className="text-2xl font-bold truncate">{stats.topArtists?.[0]?.name || '—'}</div>
            </Card>
            <Card className="p-7">
              <div className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-2">Top track ({period})</div>
              <div className="text-2xl font-bold truncate">{stats.topTracks?.[0]?.name || '—'}</div>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <Card className="p-5">
              <div className="text-zinc-400 text-[11px] font-bold uppercase tracking-widest mb-1">Last 24 hours</div>
              <div className="text-3xl font-black">{insights.plays24h}</div>
              <div className="text-xs text-zinc-500 mt-1">plays scrobbled</div>
            </Card>
            <Card className="p-5">
              <div className="text-zinc-400 text-[11px] font-bold uppercase tracking-widest mb-1">In rotation</div>
              <div className="text-3xl font-black">{insights.uniqueArtists}</div>
              <div className="text-xs text-zinc-500 mt-1">artists in recents</div>
            </Card>
            <Card className="p-5">
              <div className="text-zinc-400 text-[11px] font-bold uppercase tracking-widest mb-1">Top artist share</div>
              <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                {insights.share.toFixed(1)}%
              </div>
              <div className="text-xs text-zinc-500 mt-1 truncate">{insights.topArtist?.name || '—'}</div>
            </Card>
            <Card className="p-5">
              <div className="text-zinc-400 text-[11px] font-bold uppercase tracking-widest mb-1">
                To {insights.next.toLocaleString()}
              </div>
              <div className="text-3xl font-black">{(insights.next - insights.total).toLocaleString()}</div>
              <div className="text-xs text-zinc-500 mt-1 mb-2">plays to go</div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${insights.pct}%` }} />
              </div>
            </Card>
          </div>

          {showStrip && (
            <div className="flex flex-wrap gap-2 mb-6">
              {streak > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-300 text-sm font-bold">
                  <img src="https://cdn.discordapp.com/emojis/1551046550862569561.gif" alt="fire" className="w-4 h-4" />
                  {streak} day streak{longestStreak > streak ? ` · best ${longestStreak}` : ''}
                </span>
              )}
              {avgPerDay > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-200 text-sm font-bold">
                  <CalendarDays className="w-4 h-4 text-indigo-300" />
                  {avgPerDay.toLocaleString(undefined, { maximumFractionDigits: 1 })} / day
                </span>
              )}
            </div>
          )}

          {hasClock && (
            <Card className="p-6 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-indigo-300" />
                <div className="text-zinc-200 text-sm font-bold">Listening clock</div>
                <div className="text-zinc-500 text-xs font-semibold ml-auto">UTC hour</div>
              </div>
              <div className="flex items-end gap-1 h-24 mt-4">
                {clock.map((v, i) => (
                  <div
                    key={i}
                    title={`${i}:00 — ${v.toLocaleString()} plays`}
                    style={{ height: v > 0 ? `${Math.max(8, (v / clockMax) * 100)}%` : '6px' }}
                    className={`flex-1 rounded-md ${v > 0 ? 'bg-gradient-to-t from-indigo-500/70 to-purple-400/90' : 'bg-white/5'}`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-zinc-500 mt-2 font-semibold">
                <span>0</span>
                <span>6</span>
                <span>12</span>
                <span>18</span>
              </div>
            </Card>
          )}

          {hasDaily && (
            <Card className="p-6 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays className="w-4 h-4 text-indigo-300" />
                <div className="text-zinc-200 text-sm font-bold">Last 14 days</div>
                <div className="text-zinc-500 text-xs font-semibold ml-auto">{daily.length} days</div>
              </div>
              <div className="flex items-end gap-1.5 h-28 mt-4">
                {daily.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full min-w-0" title={`${d.date} — ${d.plays.toLocaleString()} plays`}>
                    <div
                      style={{ height: d.plays > 0 ? `${Math.max(8, (d.plays / dailyMax) * 100)}%` : '6px' }}
                      className={`w-full rounded-md ${d.plays > 0 ? 'bg-gradient-to-t from-indigo-500/70 to-purple-400/90' : 'bg-white/5'}`}
                    />
                    <div className="text-[10px] text-zinc-500 font-semibold truncate w-full text-center">{d.date.slice(3) || d.date}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {hasGenres && (
            <Card className="p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Disc3 className="w-4 h-4 text-indigo-300" />
                <div className="text-zinc-200 text-sm font-bold">Top genres</div>
              </div>
              <div className="space-y-3">
                {genres.map((g) => (
                  <div key={g.name}>
                    <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
                      <span className="font-bold text-zinc-200 truncate">{g.name}</span>
                      <span className="text-zinc-500 font-semibold shrink-0">{g.count.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        style={{ width: `${genreMax > 0 ? Math.max(4, (g.count / genreMax) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {hasDiscoveries && (
            <Card className="p-6 mb-10">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-indigo-300" />
                <div className="text-zinc-200 text-sm font-bold">New discoveries</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {discoveries.map((d) => (
                  <span key={d} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-semibold text-zinc-200 truncate max-w-full">
                    {d}
                  </span>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-6 mb-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex-1 min-w-[180px]">
                <div className="text-zinc-200 text-sm font-bold">📊 {(recap?.title as string) || 'Your week in music'}</div>
                <div className="text-zinc-500 text-xs font-semibold mt-0.5">
                  {(recap?.label as string) || (recapPeriod === 'month' ? 'Last 30 days' : 'Last 7 days')}
                  {recap && (recap as any).total != null ? ` · ${Number((recap as any).total).toLocaleString()} plays${(recap as any).capped ? '+' : ''}` : ''}
                </div>
              </div>
              <div className="flex gap-2">
                {(['week', 'month'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setRecapPeriod(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${recapPeriod === p ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'}`}
                  >
                    {p === 'week' ? 'Week' : 'Month'}
                  </button>
                ))}
              </div>
            </div>
            {recapLoading ? (
              <Spinner label="Loading recap…" />
            ) : recap ? (
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <div className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest mb-2">Top tracks</div>
                  <div className="space-y-2">
                    {((recap as any).topTracks || []).map((t: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl p-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                          {t.image ? <img src={t.image} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-sm">🎵</div>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate">{t.name}</div>
                          <div className="text-xs text-zinc-500 truncate">{t.artist} · {Number(t.playcount || 0).toLocaleString()} plays</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest mb-2">Top artists</div>
                  <div className="space-y-2">
                    {((recap as any).topArtists || []).map((a: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl p-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-zinc-800 overflow-hidden shrink-0">
                          {a.image ? <img src={a.image} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-sm">🎤</div>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate">{a.name}</div>
                          <div className="text-xs text-zinc-500 truncate">{Number(a.playcount || 0).toLocaleString()} plays</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest mb-2">Top albums</div>
                  <div className="space-y-2">
                    {((recap as any).topAlbums || []).map((b: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl p-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                          {b.image ? <img src={b.image} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-sm">💿</div>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate">{b.name}</div>
                          <div className="text-xs text-zinc-500 truncate">{b.artist} · {Number(b.playcount || 0).toLocaleString()} plays</div>
                        </div>
                      </div>
                    ))}
                    {((recap as any).discoveries || []).length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {((recap as any).discoveries || []).map((d: string) => (
                          <span key={d} className="px-2.5 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-200 text-xs font-semibold truncate max-w-full">✨ {d}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <Empty title="No recap yet" hint="Listen to something this week and check back." />
            )}
          </Card>

          <div className="flex items-center justify-between mb-5 gap-4">
            <div className="flex-1"><SectionTitle>Recent tracks</SectionTitle></div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter recents…"
              className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm w-56 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <Card className="overflow-hidden">
            {recents.length === 0 ? (
              <div className="p-6"><Empty title="No tracks found" hint="Try a different filter or scrobble something." /></div>
            ) : (
              recents.slice(0, 15).map((t, i) => (
                <div key={i} className="flex items-center gap-4 p-4 hover:bg-white/[0.04] border-b border-white/5 last:border-0">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800 overflow-hidden shrink-0">
                    {t.image ? <img src={t.image} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center">🎵</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate flex items-center gap-2">
                      {t.name}
                      {t.nowPlaying && <span className="text-[10px] uppercase font-black tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">Playing</span>}
                    </div>
                    <div className="text-sm text-zinc-400 truncate">{t.artist}</div>
                  </div>
                </div>
              ))
            )}
          </Card>
        </>
      )}
    </div>
  );
}
