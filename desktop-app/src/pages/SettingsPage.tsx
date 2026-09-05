import { useEffect, useState } from 'react';
import { API_BASE, APP_VERSION } from '../lib/config';
import { Card } from '../components/ui';

function Toggle({ value, onChange, title, hint }: { value: boolean; onChange: (v: boolean) => void; title: string; hint: string }) {
  return (
    <label className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 cursor-pointer">
      <div>
        <div className="font-bold text-sm">{title}</div>
        <div className="text-zinc-400 text-xs mt-1">{hint}</div>
      </div>
      <input type="checkbox" className="hidden" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <div className={`w-12 h-6 rounded-full p-1 transition-colors ${value ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${value ? 'translate-x-6' : ''}`} />
      </div>
    </label>
  );
}

export default function SettingsPage({ onLogout }: { onLogout: () => void }) {
  const [polling, setPolling] = useState(localStorage.getItem('ds_polling') !== 'off');
  const [rpc, setRpc] = useState(localStorage.getItem('ds_rpc') !== 'off');

  useEffect(() => {
    localStorage.setItem('ds_polling', polling ? 'on' : 'off');
  }, [polling]);
  useEffect(() => {
    localStorage.setItem('ds_rpc', rpc ? 'on' : 'off');
  }, [rpc]);

  return (
    <div className="max-w-3xl mx-auto pb-20 animate-fade-in">
      <h1 className="text-4xl font-black mb-8">Settings</h1>
      <div className="space-y-5">
        <Card className="p-6 space-y-4">
          <h2 className="font-bold">Behavior</h2>
          <Toggle value={polling} onChange={setPolling} title="Live auto-refresh" hint="Poll stats / Spotify every 15s." />
          <Toggle value={rpc} onChange={setRpc} title="Discord Rich Presence" hint="Show current track in Discord." />
        </Card>
        <Card className="p-6">
          <h2 className="font-bold mb-2">App</h2>
          <p className="text-sm text-zinc-400">Version v{APP_VERSION} · API {API_BASE}</p>
          <div className="flex gap-2 mt-4">
            <button onClick={() => window.open(`${API_BASE}/download`, '_blank')} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 font-bold hover:bg-white/10">
              Check for updates
            </button>
            <button onClick={onLogout} className="px-5 py-2.5 rounded-xl bg-red-500/10 text-red-300 border border-red-500/30 font-bold hover:bg-red-500/20">
              Log out
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
