import { useEffect, useRef, useState } from 'react';
import { Gauge, Trophy, HeartHandshake, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';
import { Card, Empty, SectionTitle, Spinner, ErrorBox } from '../components/ui';

type Section = 'whoknows' | 'pace' | 'taste';

interface Suggestion {
  name: string;
  artist?: string;
  image?: string;
}

function AutocompleteInput({
  token,
  kind,
  value,
  onPick,
  onChange,
  placeholder,
}: {
  token: string | null;
  kind: string;
  value: string;
  onPick: (s: Suggestion) => void;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const fetchFor = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.toolsAutocomplete(token, kind, q.trim());
        const list = Array.isArray(data.suggestions) ? data.suggestions : [];
        setSuggestions(list.slice(0, 7));
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          fetchFor(e.target.value);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
      />
      {open && (suggestions.length > 0 || loading) && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          {loading && suggestions.length === 0 && <div className="px-4 py-2 text-xs text-zinc-500">Searching…</div>}
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onPick(s);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center gap-3"
            >
              {s.image && <img src={s.image} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />}
              <span className="min-w-0">
                <span className="block text-sm font-bold truncate">{s.name}</span>
                {s.artist && <span className="block text-xs text-zinc-500 truncate">{s.artist}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface WhoKnowsRow {
  name: string;
  plays: number;
  share: number;
  avatar?: string;
}

function WhoKnows({ token }: { token: string | null }) {
  const [kind, setKind] = useState<'artist' | 'track' | 'album'>('artist');
  const [artist, setArtist] = useState('');
  const [track, setTrack] = useState('');
  const [album, setAlbum] = useState('');
  const [rows, setRows] = useState<WhoKnowsRow[]>([]);
  const [listeners, setListeners] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!artist.trim()) {
      toast.error('Enter an artist first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.toolsWhoKnows(token, {
        kind,
        artist: artist.trim(),
        track: kind === 'track' ? track.trim() || undefined : undefined,
        album: kind === 'album' ? album.trim() || undefined : undefined,
      });
      const list = Array.isArray(data.leaderboard) ? (data.leaderboard as Record<string, unknown>[]) : [];
      setRows(
        list.map((r) => ({
          name: String(r.name ?? r.username ?? r.user ?? '—'),
          plays: Number(r.plays ?? r.playcount ?? r.scrobbles ?? 0),
          share: Number(r.share ?? r.percent ?? 0),
          avatar: typeof r.avatar === 'string' ? r.avatar : typeof r.image === 'string' ? r.image : undefined,
        }))
      );
      const l = data.listeners ?? data.total ?? null;
      setListeners(typeof l === 'number' ? l : l != null ? Number(l) || null : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold"
        >
          <option value="artist">Artist</option>
          <option value="track">Track</option>
          <option value="album">Album</option>
        </select>
        <div className="flex-1 min-w-[180px]">
          <AutocompleteInput token={token} kind="artist" value={artist} onChange={setArtist} onPick={(s) => setArtist(s.name)} placeholder="Artist…" />
        </div>
        {kind === 'track' && (
          <div className="flex-1 min-w-[180px]">
            <AutocompleteInput token={token} kind="track" value={track} onChange={setTrack} onPick={(s) => setTrack(s.name)} placeholder="Track…" />
          </div>
        )}
        {kind === 'album' && (
          <div className="flex-1 min-w-[180px]">
            <AutocompleteInput token={token} kind="album" value={album} onChange={setAlbum} onPick={(s) => setAlbum(s.name)} placeholder="Album…" />
          </div>
        )}
        <button onClick={run} disabled={loading} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-bold text-sm flex items-center gap-2">
          <Search size={14} /> {loading ? '…' : 'Who knows'}
        </button>
      </div>
      {loading && <Spinner label="Checking crowns…" />}
      {error && <ErrorBox message={error} onRetry={run} />}
      {!loading && !error && rows.length === 0 && <Empty title="No leaderboard yet" hint="Search an artist to see who plays it most." />}
      {rows.length > 0 && (
        <div>
          {listeners != null && <p className="text-xs text-zinc-500 font-semibold mb-3">{listeners.toLocaleString()} listeners</p>}
          <div className="divide-y divide-white/5">
            {rows.slice(0, 15).map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <span className="w-7 text-sm font-black text-zinc-500">{i + 1}</span>
                {r.avatar ? <img src={r.avatar} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-black text-zinc-400">{r.name.slice(0, 1).toUpperCase()}</div>}
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate text-sm">{r.name}</div>
                  <div className="h-1.5 bg-white/5 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${Math.min(100, r.share)}%` }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-black text-sm">{r.plays.toLocaleString()}</div>
                  <div className="text-[11px] text-zinc-500">{r.share.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Pace({ token }: { token: string | null }) {
  const [user, setUser] = useState('');
  const [goal, setGoal] = useState('');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.toolsPace(token, { user: user.trim() || undefined, goal: goal.trim() || undefined });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0) || 0);
  const next = (data?.next ?? {}) as Record<string, unknown>;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[160px]">
          <AutocompleteInput token={token} kind="user" value={user} onChange={setUser} onPick={(s) => setUser(s.name)} placeholder="Username (blank = you)" />
        </div>
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Goal (optional)"
          inputMode="numeric"
          className="w-40 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
        />
        <button onClick={run} disabled={loading} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-bold text-sm">
          {loading ? '…' : 'Check pace'}
        </button>
      </div>
      {loading && <Spinner label="Calculating pace…" />}
      {error && <ErrorBox message={error} onRetry={run} />}
      {!loading && !error && data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
            <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Total</div>
            <div className="text-2xl font-black mt-1">{num(data.total).toLocaleString()}</div>
            {data.user != null && String(data.user) && <div className="text-xs text-zinc-500 mt-1 truncate">{String(data.user)}</div>}
          </div>
          <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
            <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Daily rate</div>
            <div className="text-2xl font-black mt-1">{num(data.dailyRate ?? data.daily_rate).toFixed(1)}</div>
            <div className="text-xs text-zinc-500 mt-1">plays / day</div>
          </div>
          <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
            <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Next milestone</div>
            <div className="text-2xl font-black mt-1">
              {String(data.nextMilestone ?? next.reached ?? next.date ?? '—')}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {next.days != null ? `~${String(next.days)} days` : data.prevMilestone != null ? `from ${String(data.prevMilestone)}` : '—'}
            </div>
          </div>
          <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
            <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Goal ETA</div>
            <div className="text-2xl font-black mt-1">{data.goalEta != null && String(data.goalEta) ? String(data.goalEta) : '—'}</div>
            <div className="text-xs text-zinc-500 mt-1">estimated</div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Taste({ token }: { token: string | null }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!a.trim() || !b.trim()) {
      toast.error('Enter two usernames.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.toolsTaste(token, a.trim(), b.trim());
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const scoreRaw = data?.score ?? data?.compatibility ?? data?.percent ?? data?.match ?? null;
  const score = scoreRaw != null && !Number.isNaN(Number(scoreRaw)) ? Number(scoreRaw) : null;
  const sharedRaw = data?.sharedArtists ?? data?.shared ?? data?.common ?? data?.artists ?? [];
  const shared: Array<Record<string, unknown>> = Array.isArray(sharedRaw)
    ? (sharedRaw as Array<string | Record<string, unknown>>).map((s) =>
        typeof s === 'string' ? { name: s } : (s as Record<string, unknown>)
      )
    : [];

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[160px]">
          <AutocompleteInput token={token} kind="user" value={a} onChange={setA} onPick={(s) => setA(s.name)} placeholder="First user…" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <AutocompleteInput token={token} kind="user" value={b} onChange={setB} onPick={(s) => setB(s.name)} placeholder="Second user…" />
        </div>
        <button onClick={run} disabled={loading} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-bold text-sm">
          {loading ? '…' : 'Compare'}
        </button>
      </div>
      {loading && <Spinner label="Comparing taste…" />}
      {error && <ErrorBox message={error} onRetry={run} />}
      {!loading && !error && data && (
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              {score != null ? `${score > 1 && score <= 100 ? score.toFixed(0) : score > 1 ? score.toFixed(0) : (score * 100).toFixed(0)}%` : '—'}
            </div>
            <div className="text-sm text-zinc-400">taste match{shared.length > 0 && ` · ${shared.length} shared artist${shared.length === 1 ? '' : 's'}`}</div>
          </div>
          {shared.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {shared.slice(0, 20).map((s, i) => (
                <span key={i} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-semibold">
                  {String(s.name ?? s.artist ?? s.title ?? `Artist ${i + 1}`)}
                </span>
              ))}
            </div>
          ) : (
            <Empty title="No shared artists found" hint="Try two users with overlapping libraries." />
          )}
        </div>
      )}
    </Card>
  );
}

export default function ToolsPage({ token }: { token: string | null }) {
  const [section, setSection] = useState<Section>('whoknows');
  const tabs: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'whoknows', label: 'WhoKnows', icon: <Trophy size={16} /> },
    { id: 'pace', label: 'Pace', icon: <Gauge size={16} /> },
    { id: 'taste', label: 'Taste', icon: <HeartHandshake size={16} /> },
  ];

  return (
    <div className="max-w-4xl mx-auto pb-28 animate-fade-in">
      <h1 className="text-4xl font-black mb-2">Tools</h1>
      <p className="text-zinc-400 text-sm mb-6">Crowns, milestones and compatibility — same data as the bot.</p>
      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              section === t.id
                ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {section === 'whoknows' && (
        <div>
          <div className="mb-4"><SectionTitle>Who knows this best?</SectionTitle></div>
          <WhoKnows token={token} />
        </div>
      )}
      {section === 'pace' && (
        <div>
          <div className="mb-4"><SectionTitle>Milestone pace</SectionTitle></div>
          <Pace token={token} />
        </div>
      )}
      {section === 'taste' && (
        <div>
          <div className="mb-4"><SectionTitle>Taste match</SectionTitle></div>
          <Taste token={token} />
        </div>
      )}
    </div>
  );
}
