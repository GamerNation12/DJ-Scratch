import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';
import type { Friend } from '../lib/types';
import { Card, Empty, Spinner } from '../components/ui';

export default function FriendsPage({ token }: { token: string | null }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getFriends(token);
      setFriends((data.friends || []) as Friend[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (action: string, targetId?: string, targetUsername?: string) => {
    if (!token) return;
    setBusy(true);
    try {
      const res = await api.friendAction(token, { action, targetId, targetUsername });
      if (res.success) {
        toast.success('Done');
        setName('');
        load();
      } else toast.error(res.error || 'Failed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const incoming = friends.filter((f) => f.status === 'pending' && f.direction === 'incoming');
  const outgoing = friends.filter((f) => f.status === 'pending' && f.direction === 'outgoing');
  const accepted = friends.filter((f) => f.status === 'accepted');

  if (loading) return <Spinner label="Loading friends…" />;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-28 animate-fade-in">
      <h1 className="text-4xl font-black tracking-tight">Friends</h1>
      <Card className="p-6">
        <h2 className="font-bold mb-3">Add a friend</h2>
        <div className="flex gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Discord username"
            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
          />
          <button disabled={!name || busy} onClick={() => act('request', undefined, name)} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-bold">
            Send
          </button>
        </div>
      </Card>

      {(incoming.length > 0 || outgoing.length > 0) && (
        <Card className="p-6">
          <h2 className="font-bold mb-3">Requests ({incoming.length + outgoing.length})</h2>
          <div className="space-y-2">
            {incoming.map((f) => (
              <div key={f.friend_id} className="flex items-center justify-between bg-black/30 p-3 rounded-2xl border border-white/5">
                <span className="font-bold">{f.display_name || f.friend_username}</span>
                <div className="flex gap-2">
                  <button onClick={() => act('accept', f.friend_id)} className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold">Accept</button>
                  <button onClick={() => act('reject', f.friend_id)} className="px-4 py-2 rounded-xl bg-red-500/20 text-red-300 font-bold">Decline</button>
                </div>
              </div>
            ))}
            {outgoing.map((f) => (
              <div key={f.friend_id} className="flex items-center justify-between bg-black/30 p-3 rounded-2xl border border-white/5">
                <span className="font-bold">{f.display_name || f.friend_username} <span className="text-zinc-500 text-sm">· sent</span></span>
                <button onClick={() => act('remove', f.friend_id)} className="px-4 py-2 rounded-xl bg-white/5 font-bold">Cancel</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="font-bold mb-3">Your friends ({accepted.length})</h2>
        {accepted.length === 0 ? (
          <Empty title="No friends yet" hint="Send a request above to get started." />
        ) : (
          <div className="space-y-2">
            {accepted.map((f) => (
              <div key={f.friend_id} className="flex items-center justify-between bg-black/30 p-3 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black">
                    {(f.display_name || f.friend_username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold">{f.display_name || f.friend_username}</div>
                    <div className="text-xs text-zinc-500">@{f.friend_username}</div>
                  </div>
                </div>
                <button onClick={() => act('remove', f.friend_id)} className="px-4 py-2 rounded-xl bg-red-500/10 text-red-300 font-bold">Remove</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
