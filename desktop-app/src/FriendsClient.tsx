import { useState, useEffect } from 'react';
import { UserPlus, Check, X, MessageSquare, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = 'https://dj-scratch.vercel.app';

export default function FriendsClient({ token }: { token: string | null }) {
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetUsername, setTargetUsername] = useState('');

  const fetchFriends = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/friends`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.friends) {
        setFriends(data.friends);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, [token]);

  const handleAction = async (action: string, targetId?: string, targetUsernameStr?: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/friends`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action, targetId, targetUsername: targetUsernameStr })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Successfully ${action === 'request' ? 'sent request' : action + 'ed'}`);
        setTargetUsername('');
        fetchFriends();
      } else {
        toast.error(data.error || 'An error occurred');
      }
    } catch (err) {
      toast.error('Failed to perform action');
    }
  };

  const pendingIncoming = friends.filter(f => f.status === 'pending' && f.direction === 'incoming');
  const pendingOutgoing = friends.filter(f => f.status === 'pending' && f.direction === 'outgoing');
  const acceptedFriends = friends.filter(f => f.status === 'accepted');

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in-up pb-32">
      <h1 className="text-4xl font-black mb-8 tracking-tight">Friends</h1>

      {/* Add Friend */}
      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
          <UserPlus className="w-5 h-5 text-indigo-400" />
          Add a Friend
        </h2>
        <div className="flex gap-4">
          <input
            type="text"
            value={targetUsername}
            onChange={(e) => setTargetUsername(e.target.value)}
            placeholder="Discord Username"
            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            onClick={() => handleAction('request', undefined, targetUsername)}
            disabled={!targetUsername}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
          >
            Send Request
          </button>
        </div>
      </div>

      {/* Pending Requests */}
      {(pendingIncoming.length > 0 || pendingOutgoing.length > 0) && (
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl">
          <h2 className="text-xl font-bold mb-4 text-white">Pending Requests</h2>
          <div className="space-y-3">
            {pendingIncoming.map(f => (
              <div key={f.friend_id} className="flex items-center justify-between bg-black/30 p-4 rounded-2xl border border-white/5">
                <div>
                  <p className="font-bold text-lg">{f.display_name || f.friend_username}</p>
                  <p className="text-sm text-zinc-400">wants to be your friend</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAction('accept', f.friend_id)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-xl transition-all hover:scale-105 font-bold">
                    <Check className="w-5 h-5" /> Accept
                  </button>
                  <button onClick={() => handleAction('reject', f.friend_id)} className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl transition-all hover:scale-105 font-bold">
                    <X className="w-5 h-5" /> Decline
                  </button>
                </div>
              </div>
            ))}
            {pendingOutgoing.map(f => (
              <div key={f.friend_id} className="flex items-center justify-between bg-black/30 p-4 rounded-2xl border border-white/5">
                <div>
                  <p className="font-bold text-lg">{f.display_name || f.friend_username}</p>
                  <p className="text-sm text-zinc-400">Request sent</p>
                </div>
                <button onClick={() => handleAction('remove', f.friend_id)} className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl font-bold transition-colors">
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-white">Your Friends</h2>
        {acceptedFriends.length === 0 ? (
          <div className="text-center py-10 bg-black/20 rounded-2xl border border-dashed border-white/10">
            <p className="text-zinc-500">No friends yet.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {acceptedFriends.map(f => (
              <div key={f.friend_id} className="flex items-center justify-between bg-black/30 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
                    {(f.display_name || f.friend_username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{f.display_name || f.friend_username}</p>
                    <p className="text-sm text-zinc-500">@{f.friend_username}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    if (confirm("Are you sure you want to remove this friend?")) {
                      handleAction('remove', f.friend_id);
                    }
                  }} className="p-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-all hover:scale-110">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
