import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Card, ErrorBox, Spinner } from '../components/ui';

export default function AdminPage({ token }: { token: string | null }) {
  const [role, setRole] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, number | string> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const check = await api.checkAdmin(token);
        setRole(check.role || null);
        if (check.role === 'admin' || check.role === 'owner') {
          const s = await api.getAdminStats(token);
          setStats({
            plays: Number(s.totalPlays ?? 0),
            users: Number(s.totalUsers ?? 0),
            guilds: Number((s.botStats as { server_count?: number } | undefined)?.server_count ?? 0),
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Not authorized');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) return <Spinner label="Checking admin access…" />;
  if (error || !role) return <div className="max-w-2xl mx-auto"><ErrorBox message={error || 'No admin access'} /></div>;

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-fade-in">
      <h1 className="text-4xl font-black mb-2">Admin</h1>
      <p className="text-zinc-400 mb-6 text-sm">Role: <span className="text-indigo-300 font-bold">{role}</span> · Full console lives on the website.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total scrobbles', value: stats?.plays ?? '—' },
          { label: 'Users', value: stats?.users ?? '—' },
          { label: 'Guilds', value: stats?.guilds ?? '—' },
        ].map((s) => (
          <Card key={s.label} className="p-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold">{s.label}</div>
            <div className="text-3xl font-black mt-1">{Number(s.value || 0).toLocaleString()}</div>
          </Card>
        ))}
      </div>
      <Card className="p-6 mt-6">
        <h2 className="font-bold mb-2">Open full console</h2>
        <p className="text-sm text-zinc-400 mb-4">User management, permissions, suggestions and system tools are on the web dashboard.</p>
        <button onClick={() => window.open('https://dj-scratch.vercel.app/admin', '_blank')} className="px-5 py-2.5 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-500">
          Open web admin
        </button>
      </Card>
    </div>
  );
}
