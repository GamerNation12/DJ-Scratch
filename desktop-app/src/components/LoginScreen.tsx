import { API_BASE, APP_VERSION } from '../lib/config';
import logoUrl from '../assets/logo.png';

export default function LoginScreen() {
  const login = () => {
    window.open(`${API_BASE}/api/auth/login?state=desktop`, '_blank', 'noopener');
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-white flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center p-12 bg-zinc-900/40 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl max-w-lg w-[92%]">
        <img src={logoUrl} alt="DJ Scratch logo" className="w-24 h-24 rounded-full object-cover mb-6 border-4 border-white/10" />
        <h1 className="text-4xl font-black mb-2 tracking-tight text-center">DJ Scratch</h1>
        <p className="text-zinc-500 text-xs font-mono mb-4">Desktop v{APP_VERSION}</p>
        <p className="text-zinc-400 mb-8 text-center">Sign in with Discord for live stats, leaderboard, friends, messages and Spotify controls.</p>
        <button
          onClick={login}
          className="px-8 py-4 bg-[#5865F2] hover:bg-[#4752C4] rounded-xl font-bold transition-all hover:scale-105 flex items-center gap-3"
        >
          Login with Discord
        </button>
        <p className="text-zinc-600 text-xs mt-6 text-center">After approving in your browser the app signs in automatically.</p>
      </div>
    </div>
  );
}
