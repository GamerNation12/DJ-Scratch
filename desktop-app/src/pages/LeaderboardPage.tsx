import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { LeaderboardEntry } from '../lib/types';
import { Card, Empty, ErrorBox, Spinner } from '../components/ui';

export default function LeaderboardPage({ token }: { token: string | null }) {
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getLeaderboard(token);
      setRows((data.leaderboard || []) as LeaderboardEntry[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = rows.filter((r) => !query || r.username.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="animate-fade-in max-w-3xl mx-auto pb-28">
      <div className="flex items-center justify-between gap-4 mb-8">
        <h1 className="text-4xl font-black tracking-tight">Leaderboard</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users…"
          className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm w-52 focus:outline-none focus:border-indigo-500"
        />
      </div>
      {loading && <Spinner />}
      {error && <ErrorBox message={error} onRetry={load} />}
      {!loading && !error && (
        <Card className="p-3">
          {filtered.length === 0 ? (
            <div className="p-4"><Empty title="No entries" /></div>
          ) : (
            filtered.map((u, i) => (
              <div key={i} className="flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl">
                <div className={`w-8 text-center font-black ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-zinc-200' : i === 2 ? 'text-amber-500' : 'text-zinc-500'}`}>{i + 1}</div>
                {u.avatar && <img src={u.avatar} className="w-11 h-11 rounded-full border border-white/10" alt="" />}
                <div className="flex-1 font-bold truncate">{u.username}</div>
                <div className="text-right">
                  <div className="font-black">{Number(u.total_scrobbles).toLocaleString()}</div>
                  <div className="text-[11px] text-zinc-500 uppercase font-bold">scrobbles</div>
                </div>
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );
}
