import { useState, useEffect } from 'react';
import { Home, Trophy, Play, Pause, SkipForward, SkipBack, Settings, ExternalLink } from 'lucide-react';

const API_BASE = 'https://dj-scratch.vercel.app';

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaderboard'>('dashboard');
  const [token, setToken] = useState<string | null>(localStorage.getItem('discord_jwt'));
  const [user, setUser] = useState<any>(null);
  
  // Data States
  const [stats, setStats] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    if (token) {
      // Decode JWT to get user info
      try {
        const base64Str = token.split('.')[1].replace(/-/g, "+").replace(/_/g, "/");
        const decodedUser = JSON.parse(atob(base64Str));
        setUser(decodedUser);
        
        // Initial fetch
        fetchData(decodedUser);
        
        // Setup polling every 5 seconds
        const intervalId = setInterval(() => {
          fetchData(decodedUser);
        }, 5000);
        
        return () => clearInterval(intervalId);
      } catch (e) {
        setToken(null);
        localStorage.removeItem('discord_jwt');
      }
    }
  }, [token]);

  const fetchData = async (currentUser: any) => {
    if (!currentUser) return;
    try {
      // Fetch user profile and stats
      const username = currentUser.name === "gamernation12" ? "GamerNation12" : currentUser.name;
      const statsRes = await fetch(`${API_BASE}/api/u/${username}?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const profileData = await statsRes.json();
      if (!profileData.error) setStats(profileData.stats);

      // Fetch leaderboard
      const lbRes = await fetch(`${API_BASE}/api/leaderboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const lbData = await lbRes.json();
      if (lbData.leaderboard) setLeaderboard(lbData.leaderboard);
      
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = () => {
    // Open the system browser to the Vercel login page, setting state=desktop
    window.open(`${API_BASE}/api/auth/login?state=desktop`, '_blank');
  };

  if (!token || !user) {
    return (
      <div className="flex h-screen bg-[#09090b] text-white flex-col items-center justify-center relative overflow-hidden">
        {/* Dynamic Abstract Background for Login */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] mix-blend-screen pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] mix-blend-screen pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute inset-0 bg-[url('https://dj-scratch.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>

        <div className="relative z-10 flex flex-col items-center p-12 bg-zinc-900/40 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center font-black text-3xl mb-6 shadow-2xl shadow-indigo-500/20 transform hover:scale-105 transition-transform">DJ</div>
          <h1 className="text-4xl font-black mb-3 tracking-tight">DJ Scratch Desktop</h1>
          <p className="text-zinc-400 mb-10 text-center max-w-sm">Sign in with Discord to access your personalized live-updating dashboard.</p>
          <button onClick={handleLogin} className="px-10 py-4 bg-[#5865F2] hover:bg-[#4752C4] rounded-xl font-bold transition-all hover:scale-105 shadow-[0_0_20px_rgba(88,101,242,0.3)] flex items-center gap-3 text-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04-.01-.08-.05-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.03.06.04.09.02c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12z"/></svg>
            Login with Discord
          </button>
        </div>
      </div>
    );
  }

  // Get current playing track image for dynamic background
  const nowPlayingImage = stats?.recentTracks?.[0]?.nowPlaying ? stats.recentTracks[0].image : null;

  return (
    <div className="relative flex h-screen bg-[#09090b] text-white overflow-hidden">
      {/* Draggable Title Bar Area */}
      <div className="absolute top-0 left-0 right-[140px] h-10 z-[100] app-region-drag pointer-events-none"></div>

      {/* Dynamic Album Art Blurred Background */}
      {nowPlayingImage && (
        <div 
          className="absolute inset-0 z-0 opacity-40 blur-[120px] scale-125 pointer-events-none transition-all duration-[2000ms] ease-in-out"
          style={{ 
            backgroundImage: `url(${nowPlayingImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }} 
        />
      )}
      
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 z-0 pointer-events-none"></div>
      <div className="absolute inset-0 bg-[url('https://dj-scratch.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none z-0 mix-blend-overlay"></div>

      {/* Sidebar (needs pt-10 to clear Windows controls if frameless) */}
      <div className="w-64 border-r border-white/10 bg-zinc-950/60 backdrop-blur-2xl p-4 flex flex-col pt-12 relative z-10 shadow-2xl">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center font-black shadow-[0_0_15px_rgba(99,102,241,0.5)]">DJ</div>
          <span className="font-black text-xl tracking-tight">DJ Scratch</span>
        </div>
        
        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 font-semibold ${
              activeTab === 'dashboard' 
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Home size={18} />
            Dashboard
          </button>
          
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 font-semibold ${
              activeTab === 'leaderboard' 
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Trophy size={18} />
            Leaderboard
          </button>
        </nav>
        
        <div className="mt-auto border-t border-white/10 pt-5 px-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={user.image || `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} className="w-10 h-10 rounded-full border-2 border-zinc-800" />
            <div className="text-sm font-bold truncate">{user.name}</div>
          </div>
          <button
            onClick={() => {
              setToken(null);
              setUser(null);
              localStorage.removeItem('discord_jwt');
            }}
            className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors p-2.5 rounded-xl"
            title="Logout"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative z-10 pt-10">
        <main className="flex-1 overflow-y-auto p-10 relative">
          {activeTab === 'dashboard' ? (
            <div className="animate-fade-in max-w-5xl mx-auto pb-20">
              <h1 className="text-5xl font-black mb-10 tracking-tight drop-shadow-xl">
                Welcome back, <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">{user.name}</span>
              </h1>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px] group-hover:bg-indigo-500/20 transition-colors"></div>
                  <div className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-3 relative z-10">Total Scrobbles</div>
                  <div className="text-5xl font-black text-white relative z-10">{stats?.playcount?.toLocaleString() || '...'}</div>
                </div>
                
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[40px] group-hover:bg-purple-500/20 transition-colors"></div>
                  <div className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-3 relative z-10">Top Artist</div>
                  <div className="text-3xl font-bold truncate text-white relative z-10">{stats?.topArtists?.[0]?.name || '...'}</div>
                </div>
                
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px] group-hover:bg-emerald-500/20 transition-colors"></div>
                  <div className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-3 relative z-10">Top Track</div>
                  <div className="text-2xl font-bold truncate text-white relative z-10">{stats?.topTracks?.[0]?.name || '...'}</div>
                </div>
              </div>
              
              <h2 className="text-2xl font-black mb-6 tracking-tight flex items-center gap-3">
                Recent Tracks
                <div className="h-px bg-white/10 flex-1"></div>
              </h2>
              
              <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                {stats?.recentTracks?.slice(0, 10).map((track: any, i: number) => (
                   <div key={i} className="w-full text-left flex items-center gap-5 p-5 hover:bg-white/[0.04] transition-all duration-300 group border-b border-white/5 last:border-0">
                     <div className="w-14 h-14 rounded-xl bg-zinc-800 shrink-0 overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                       {track.image ? <img src={track.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center text-xl">🎵</div>}
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="font-bold text-base text-white truncate group-hover:text-indigo-300 transition-colors flex items-center gap-3">
                         {track.name}
                         {track.nowPlaying && (
                           <span className="shrink-0 flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest border border-indigo-500/30">
                             <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                             Playing
                           </span>
                         )}
                       </div>
                       <div className="text-sm text-zinc-400 truncate mt-1.5 font-medium">{track.artist}</div>
                     </div>
                   </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-fade-in max-w-3xl mx-auto pb-20">
              <h1 className="text-5xl font-black mb-10 text-center tracking-tight">Global Leaderboard</h1>
              <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl p-4">
                {leaderboard.map((user: any, index: number) => (
                  <div key={index} className="flex items-center gap-5 p-5 hover:bg-white/5 rounded-2xl transition-all duration-300 group">
                    <div className={`w-8 text-center font-black text-xl ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-zinc-300' : index === 2 ? 'text-amber-600' : 'text-zinc-500'}`}>
                      {index + 1}
                    </div>
                    <img src={user.avatar} className="w-12 h-12 rounded-full border-2 border-white/10 shadow-lg group-hover:border-indigo-400/50 transition-colors" />
                    <div className="flex-1">
                      <div className="font-bold text-lg">{user.username}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-xl text-white group-hover:text-indigo-300 transition-colors">{parseInt(user.total_scrobbles).toLocaleString()}</div>
                      <div className="text-xs text-zinc-400 uppercase font-bold tracking-widest mt-1">scrobbles</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Floating Music Controls Bar (Bottom) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl h-24 border border-white/10 bg-zinc-900/80 backdrop-blur-2xl rounded-[2rem] flex items-center justify-between px-8 z-20 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-5 w-72">
            <div className="w-14 h-14 bg-zinc-800 rounded-xl overflow-hidden shadow-lg relative group">
               {stats?.recentTracks?.[0]?.image && <img src={stats.recentTracks[0].image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm flex items-center gap-2 overflow-hidden">
                <span className="truncate">{stats?.recentTracks?.[0]?.name || 'Not Playing'}</span>
                {stats?.recentTracks?.[0]?.nowPlaying && (
                  <div className="flex items-end gap-[2px] h-3 ml-1 shrink-0" title="Playing Now">
                    <div className="w-[3px] bg-indigo-400 rounded-t-sm animate-[pulse_1s_infinite]"></div>
                    <div className="w-[3px] bg-indigo-400 rounded-t-sm animate-[pulse_0.8s_infinite] h-full"></div>
                    <div className="w-[3px] bg-indigo-400 rounded-t-sm animate-[pulse_1.2s_infinite]"></div>
                  </div>
                )}
              </div>
              <div className="text-xs text-zinc-400 truncate mt-1">{stats?.recentTracks?.[0]?.artist || 'DJ Scratch'}</div>
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-3 flex-1">
            <div className="flex items-center gap-8">
              <button className="text-zinc-400 hover:text-white transition-colors"><SkipBack size={22} fill="currentColor" /></button>
              <button className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:shadow-[0_0_30px_rgba(255,255,255,0.6)]">
                <Play size={20} className="ml-1" fill="currentColor" />
              </button>
              <button className="text-zinc-400 hover:text-white transition-colors"><SkipForward size={22} fill="currentColor" /></button>
            </div>
            <div className="flex items-center gap-3 w-full max-w-[450px] group">
              <span className="text-[10px] text-zinc-500 font-medium font-mono">0:00</span>
              <div className="h-1.5 flex-1 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer">
                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-purple-500 w-1/3 rounded-full group-hover:shadow-[0_0_10px_rgba(99,102,241,0.8)] transition-all"></div>
              </div>
              <span className="text-[10px] text-zinc-500 font-medium font-mono">0:00</span>
            </div>
          </div>
          
          <div className="w-72 flex justify-end">
            <button className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
