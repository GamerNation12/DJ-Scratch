import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Home, Trophy, Users, Shield, Settings, LifeBuoy, Wrench } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { api } from './lib/api';
import { canonicalUsername, clearToken, decodeUser, discordAvatar, getToken } from './lib/auth';
import type { JwtUser } from './lib/types';
import LoginScreen from './pages/LoginScreen';
import { Card, Spinner } from './components/ui';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

type Tab = 'dashboard' | 'leaderboard' | 'friends' | 'tools' | 'support' | 'admin' | 'settings';

export default function App() {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<JwtUser | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [isAdmin, setIsAdmin] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const onStorage = () => {
      const t = getToken();
      setToken(t);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    const u = decodeUser(token);
    if (!u) {
      clearToken();
      setToken(null);
      return;
    }
    setUser(u);
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;
    api.checkAdmin(token)
      .then((r) => setIsAdmin(r.role === 'admin' || r.role === 'owner'))
      .catch(() => setIsAdmin(false));
  }, [token, user]);

  const logout = () => {
    clearToken();
    setToken(null);
    setUser(null);
  };

  if (!token || !user) return <LoginScreen />;

  const username = canonicalUsername(user.name);
  const nav: { id: Tab; label: string; icon: React.ReactNode; hidden?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Home size={18} /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={18} /> },
    { id: 'friends', label: 'Friends', icon: <Users size={18} /> },
    { id: 'tools', label: 'Tools', icon: <Wrench size={18} /> },
    { id: 'support', label: 'Support', icon: <LifeBuoy size={18} /> },
    { id: 'admin', label: 'Admin', icon: <Shield size={18} />, hidden: !isAdmin },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
  ];

  return (
    <div className="relative flex h-screen bg-[#09090b] text-white overflow-hidden">
      <Toaster position="bottom-center" toastOptions={{ style: { background: '#18181b', color: '#fff' } }} />
      <aside className="w-64 border-r border-white/10 bg-zinc-950/60 backdrop-blur-2xl p-4 flex flex-col pt-12 relative z-10">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div>
            <div className="font-black text-lg leading-none">DJ Scratch</div>
            <div className="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {online ? 'Connected' : 'Offline'}
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5">
          {nav
            .filter((n) => !n.hidden)
            .map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${
                  tab === n.id ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {n.icon}
                {n.label}
              </button>
            ))}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-4 px-2 flex items-center gap-3">
          {discordAvatar(user) && <img src={discordAvatar(user)} className="w-10 h-10 rounded-full" alt="" />}
          <div className="text-sm font-bold truncate flex-1">{username}</div>
          <button onClick={logout} className="text-zinc-500 hover:text-red-300 p-2" title="Logout">⎋</button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col relative z-10 pt-10">
        <main className="flex-1 overflow-y-auto p-8">
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}>
          {tab === 'dashboard' && <DashboardPage token={token} username={username} />}
          {tab === 'leaderboard' && <LeaderboardPage token={token} />}
          {tab === 'friends' && <FriendsPage token={token} />}
          {tab === 'tools' && <ToolsPage token={token} />}
          {tab === 'support' && <SupportPage token={token} />}
          {tab === 'admin' && <AdminPage token={token} />}
          {tab === 'settings' && <SettingsPage token={token} user={user} onLogout={logout} />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
