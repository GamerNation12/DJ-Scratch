"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Check, X, MessageSquare, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export default function FriendsPage() {
  const router = useRouter();
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetUsername, setTargetUsername] = useState("");

  const fetchFriends = async () => {
    const token = localStorage.getItem("discord_jwt");
    if (!token) {
      window.location.href = "/api/auth/login";
      return;
    }
    try {
      const res = await fetch("/api/friends", {
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
  }, []);

  const handleAction = async (action: string, targetId?: string, targetUsernameStr?: string) => {
    const token = localStorage.getItem("discord_jwt");
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action, targetId, targetUsername: targetUsernameStr })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Successfully ${action === 'request' ? 'sent request' : action + 'ed'}`);
        setTargetUsername("");
        fetchFriends();
      } else {
        toast.error(data.error || "An error occurred");
      }
    } catch (err) {
      toast.error("Failed to perform action");
    }
  };

  const pendingIncoming = friends.filter(f => f.status === 'pending' && f.direction === 'incoming');
  const pendingOutgoing = friends.filter(f => f.status === 'pending' && f.direction === 'outgoing');
  const acceptedFriends = friends.filter(f => f.status === 'accepted');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center pt-20">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white pt-24 px-4 sm:px-6 lg:px-8 pb-10">
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
        
        {/* Add Friend Section */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            Add a Friend
          </h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={targetUsername}
              onChange={(e) => setTargetUsername(e.target.value)}
              placeholder="Discord Username"
              className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              onClick={() => handleAction("request", undefined, targetUsername)}
              disabled={!targetUsername}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-6 py-3 rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20"
            >
              Send Request
            </button>
          </div>
        </div>

        {/* Pending Requests */}
        {(pendingIncoming.length > 0 || pendingOutgoing.length > 0) && (
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-4">Pending Requests</h2>
            <div className="space-y-4">
              {pendingIncoming.map(f => (
                <div key={f.friend_id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-black/30 p-4 rounded-xl border border-white/5 gap-4">
                  <div>
                    <p className="font-medium text-lg">{f.display_name || f.friend_username}</p>
                    <p className="text-sm text-zinc-400">wants to be your friend</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAction("accept", f.friend_id)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition-colors">
                      <Check className="w-5 h-5" /> Accept
                    </button>
                    <button onClick={() => handleAction("reject", f.friend_id)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors">
                      <X className="w-5 h-5" /> Decline
                    </button>
                  </div>
                </div>
              ))}
              {pendingOutgoing.map(f => (
                <div key={f.friend_id} className="flex items-center justify-between bg-black/30 p-4 rounded-xl border border-white/5">
                  <div>
                    <p className="font-medium">{f.display_name || f.friend_username}</p>
                    <p className="text-sm text-zinc-400">Request sent</p>
                  </div>
                  <button onClick={() => handleAction("remove", f.friend_id)} className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm transition-colors">
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends List */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-semibold mb-4">Your Friends</h2>
          {acceptedFriends.length === 0 ? (
            <div className="text-center py-12 bg-black/20 rounded-xl border border-dashed border-white/10">
              <UserPlus className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">No friends yet. Start adding some!</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {acceptedFriends.map(f => (
                <div key={f.friend_id} className="flex items-center justify-between bg-black/30 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {(f.display_name || f.friend_username).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-lg group-hover:text-indigo-300 transition-colors">{f.display_name || f.friend_username}</p>
                      <p className="text-sm text-zinc-500">@{f.friend_username}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => router.push(`/messages?u=${f.friend_id}`)} className="p-2.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:scale-105 rounded-xl transition-all" title="Message">
                      <MessageSquare className="w-5 h-5" />
                    </button>
                    <button onClick={() => {
                      if(confirm("Are you sure you want to remove this friend?")) {
                        handleAction("remove", f.friend_id);
                      }
                    }} className="p-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:scale-105 rounded-xl transition-all" title="Remove Friend">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
