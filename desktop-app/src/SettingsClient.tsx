import { useState } from 'react';
import { LogOut, Monitor, Bell, Shield, Paintbrush, PlayCircle } from 'lucide-react';

export default function SettingsClient({ onLogout }: { onLogout: () => void }) {
  const [theme, setTheme] = useState('dark');
  const [notifications, setNotifications] = useState(true);
  const [autoStart, setAutoStart] = useState(false);
  const [hardwareAccel, setHardwareAccel] = useState(true);

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-fade-in-up">
      <h1 className="text-4xl font-black mb-8 tracking-tight drop-shadow-xl text-white">
        Preferences
      </h1>

      <div className="space-y-6">
        {/* Appearance Settings */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px] pointer-events-none"></div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <Paintbrush className="text-indigo-400" size={24} />
            <h2 className="text-xl font-bold text-white">Appearance</h2>
          </div>
          
          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
              <div>
                <h3 className="font-bold text-white text-sm">Theme Selection</h3>
                <p className="text-zinc-400 text-xs mt-1">Choose your preferred visual style.</p>
              </div>
              <div className="flex bg-zinc-950 rounded-xl p-1 border border-white/10">
                <button onClick={() => setTheme('dark')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-500 hover:text-white'}`}>Dark</button>
                <button onClick={() => setTheme('light')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${theme === 'light' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-500 hover:text-white'}`}>Light</button>
              </div>
            </div>
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px] pointer-events-none"></div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <Monitor className="text-emerald-400" size={24} />
            <h2 className="text-xl font-bold text-white">System & Startup</h2>
          </div>
          
          <div className="space-y-4 relative z-10">
            <label className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 cursor-pointer hover:bg-black/40 transition-colors">
              <div>
                <h3 className="font-bold text-white text-sm">Launch on Startup</h3>
                <p className="text-zinc-400 text-xs mt-1">Automatically open DJ Scratch when you start your computer.</p>
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors ${autoStart ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${autoStart ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </div>
              {/* Hidden input to make it accessible */}
              <input type="checkbox" className="hidden" checked={autoStart} onChange={(e) => setAutoStart(e.target.checked)} />
            </label>

            <label className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 cursor-pointer hover:bg-black/40 transition-colors">
              <div>
                <h3 className="font-bold text-white text-sm">Hardware Acceleration</h3>
                <p className="text-zinc-400 text-xs mt-1">Uses your GPU to make animations smoother.</p>
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors ${hardwareAccel ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${hardwareAccel ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </div>
              <input type="checkbox" className="hidden" checked={hardwareAccel} onChange={(e) => setHardwareAccel(e.target.checked)} />
            </label>
          </div>
        </div>

        {/* Account Settings */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden border-l-4 border-l-red-500">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[40px] pointer-events-none"></div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <Shield className="text-red-400" size={24} />
            <h2 className="text-xl font-bold text-white">Account Management</h2>
          </div>
          
          <div className="space-y-4 relative z-10">
            <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
              <div>
                <h3 className="font-bold text-white text-sm">Active Session</h3>
                <p className="text-zinc-400 text-xs mt-1">You are currently securely authenticated via Discord OAuth.</p>
              </div>
              <button 
                onClick={onLogout}
                className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(239,68,68,0.15)]"
              >
                <LogOut size={16} />
                Log Out Securely
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
