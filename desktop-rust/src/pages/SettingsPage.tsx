export default function SettingsPage({ token, user, onLogout }: { token: string; user: any; onLogout: () => void }) {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-black mb-8">Settings</h1>
      <p className="text-zinc-400">Desktop app in progress.</p>
      <button onClick={onLogout} className="mt-4 px-6 py-2 rounded-xl bg-red-500/10 text-red-300 border border-red-500/30 font-bold hover:bg-red-500/20">
        Log out
      </button>
    </div>
  );
}
