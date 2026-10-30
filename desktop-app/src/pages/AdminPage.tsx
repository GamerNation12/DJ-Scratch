import { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, Bot, Bot as BotIcon, ShieldAlert, Users, User, Lock, Key, Mail, MessageSquare, Settings as SettingsIcon, Wrench, Plus, Trash2, Edit, RotateCcw, RefreshCw, Bell, Mail as MailIcon, Send } from 'lucide-react';
import { api } from '../lib/api';
import { Card, Dialog, ErrorBox, SectionTitle, Spinner, Tabs } from '../components/ui';
import { API_BASE } from '../lib/config';

type AdminUser = {
  user_id: string;
  discord_username: string | null;
  lastfm_username: string | null;
  display_name: string | null;
  is_banned: boolean;
  ban_reason: string | null;
  ban_expires_at: string | null;
  private_mode: boolean;
};

type AdminTab = 'overview' | 'users' | 'admins' | 'commands' | 'permissions' | 'actions';

export default function AdminPage({ token }: { token: string | null }) {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Overview
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  // Users
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [userModal, setUserModal] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });
  const [newDisplayName, setNewDisplayName] = useState('');

  // Admins/mods
  const [access, setAccess] = useState<{ admins: string[]; moderators: string[] } | null>(null);
  const [newAdminId, setNewAdminId] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'admin' | 'moderator'>('admin');

  // Commands
  const [lockedCommands, setLockedCommands] = useState<string[]>([]);
  const [lockCmdName, setLockCmdName] = useState('');
  const [lockCmdReason, setLockCmdReason] = useState('');

  // Permissions
  const [permissions, setPermissions] = useState<Array<{ user_id: string; command_name: string; granted_at: string; expires_at: string | null }>>([]);
  const [permUserId, setPermUserId] = useState('');
  const [permCmdName, setPermCmdName] = useState('');
  const [permDuration, setPermDuration] = useState<string | null>(null);

  // Bot actions
  const [globalVersion, setGlobalVersion] = useState('');
  const [globalMessage, setGlobalMessage] = useState('');
  const [sendChannelId, setSendChannelId] = useState('');
  const [sendMessage, setSendMessage] = useState('');

  // Support
  const [supportThreads, setSupportThreads] = useState<Array<{ id: string; name: string; email: string; status: string; updated_at: string; preview: string | null; visitor_msgs: number }>>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [supportMsgs, setSupportMsgs] = useState<Array<{ id: number; sender: string; body: string; created_at: string; email_sent: boolean }>>([]);
  const [supportDraft, setSupportDraft] = useState('');

  const tabs: ReadonlyArray<{ value: AdminTab; label: string }> = [
    { value: 'overview', label: 'Overview' },
    { value: 'users', label: 'Users' },
    { value: 'admins', label: 'Admins' },
    { value: 'commands', label: 'Commands' },
    { value: 'permissions', label: 'Permissions' },
    { value: 'actions', label: 'Bot Actions' },
  ];

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setLoading(true);
        const [checkRes, statsRes] = await Promise.all([
          api.checkAdmin(token),
          api.getAdminStats(token),
        ]);
        const role = checkRes.role;
        if (role !== 'owner' && role !== 'admin') {
          setError('Not authorized');
          return;
        }
        setStats(statsRes as Record<string, unknown>);
        await Promise.all([
          loadAdminUsers(),
          loadAccess(),
          loadLockedCommands(),
          loadPermissions(),
          loadSupportThreads(),
        ]);
      } catch (e: any) {
        setError(e?.message || 'Failed to load admin data');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ---------- Users ----------
  const loadAdminUsers = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getAdminUsersList(token);
      setAdminUsers(data.users || []);
    } catch { /* ignore */ }
  }, [token]);

  const handleUserAction = async (userId: string, actionType: 'BAN' | 'UNBAN' | 'EDIT_NAME' | 'RESET', payload?: Record<string, unknown>) => {
    if (!token) return;
    try {
      await api.adminUserAction(token, userId, actionType, payload);
      await loadAdminUsers();
      setUserModal({ open: false, user: null });
    } catch (e: any) {
      alert(e?.message || 'Action failed');
    }
  };

  // ---------- Admins / Mods ----------
  const loadAccess = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getAdminUsers(token);
      setAccess(data);
    } catch { /* ignore */ }
  }, [token]);

  const addAdmin = async () => {
    if (!token || !newAdminId) return;
    try {
      const data = await api.setAdminUser(token, newAdminId, newAdminRole);
      setAccess(data.adminUsers);
      setNewAdminId('');
    } catch (e: any) {
      alert(e?.message || 'Failed to add admin');
    }
  };

  const removeAdmin = async (id: string) => {
    if (!token) return;
    if (!confirm('Remove this admin/moderator?')) return;
    try {
      const data = await api.removeAdminUser(token, id);
      setAccess(data.adminUsers);
    } catch (e: any) {
      alert(e?.message || 'Failed to remove admin');
    }
  };

  // ---------- Commands ----------
  const loadLockedCommands = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getLockedCommands(token);
      setLockedCommands(data);
    } catch { /* ignore */ }
  }, [token]);

  const handleLockCommand = async () => {
    if (!token || !lockCmdName || !lockCmdReason) return;
    try {
      await api.lockCommand(token, lockCmdName, lockCmdReason);
      setLockCmdName('');
      setLockCmdReason('');
      await loadLockedCommands();
    } catch (e: any) {
      alert(e?.message || 'Failed to lock command');
    }
  };

  const handleUnlockCommand = async (cmd: string) => {
    if (!token) return;
    try {
      await api.unlockCommand(token, cmd);
      await loadLockedCommands();
    } catch (e: any) {
      alert(e?.message || 'Failed to unlock command');
    }
  };

  // ---------- Permissions ----------
  const loadPermissions = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getPermissions(token);
      setPermissions(data);
    } catch { /* ignore */ }
  }, [token]);

  const handleAddPermission = async () => {
    if (!token || !permUserId || !permCmdName) return;
    try {
      await api.addPermission(token, permUserId, permCmdName, permDuration);
      setPermUserId('');
      setPermCmdName('');
      setPermDuration(null);
      await loadPermissions();
    } catch (e: any) {
      alert(e?.message || 'Failed to add permission');
    }
  };

  const handleRemovePermission = async (userId: string, commandName: string) => {
    if (!token) return;
    try {
      await api.removePermission(token, userId, commandName);
      await loadPermissions();
    } catch (e: any) {
      alert(e?.message || 'Failed to remove permission');
    }
  };

  // ---------- Bot Actions ----------
  const handleAdminAction = async (actionType: string, payload?: Record<string, unknown>) => {
    if (!token) return;
    if (!confirm(`Run "${actionType}"?`)) return;
    try {
      await api.adminAction(token, actionType, payload);
      alert('Action queued.');
    } catch (e: any) {
      alert(e?.message || 'Action failed');
    }
  };

  const handleSetGlobalUpdate = async () => {
    if (!token || !globalVersion || !globalMessage) return;
    try {
      await api.adminAction(token, 'SET_GLOBAL_UPDATE', { version: globalVersion, message: globalMessage });
      setGlobalVersion('');
      setGlobalMessage('');
      alert('Global update set.');
    } catch (e: any) {
      alert(e?.message || 'Failed to set global update');
    }
  };

  const handleSendMessage = async () => {
    if (!token || !sendChannelId || !sendMessage) return;
    try {
      await api.adminAction(token, 'SEND_MESSAGE', { channelId: sendChannelId, content: sendMessage });
      setSendChannelId('');
      setSendMessage('');
      alert('Message sent.');
    } catch (e: any) {
      alert(e?.message || 'Failed to send message');
    }
  };

  // ---------- Support ----------
  const loadSupportThreads = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/support-chat`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSupportThreads(Array.isArray(data.threads) ? data.threads : []);
      }
    } catch { /* ignore */ }
  }, [token]);

  const loadSupportMsgs = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/support-chat?threadId=${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSupportMsgs(Array.isArray(data.messages) ? data.messages : []);
      }
    } catch { /* ignore */ }
  }, [token]);

  const sendSupportReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || !supportDraft.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/support-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'reply', threadId: activeThread, body: supportDraft.trim() }),
      });
      if (!res.ok) throw new Error('Send failed');
      setSupportDraft('');
      await loadSupportMsgs(activeThread);
    } catch (e: any) {
      alert(e?.message || 'Couldn\'t send');
    }
  };

  const closeSupportThread = async () => {
    if (!activeThread) return;
    try {
      const res = await fetch(`${API_BASE}/api/support-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'close', threadId: activeThread }),
      });
      if (!res.ok) throw new Error('Close failed');
      setActiveThread(null);
      await loadSupportThreads();
    } catch (e: any) {
      alert(e?.message || 'Failed to close');
    }
  };

  if (loading) return <Spinner label="Loading admin panel…" />;
  if (error) return <div className="max-w-2xl mx-auto"><ErrorBox message={error} /></div>;

  const tabComponents = {
    overview: (
      <Card className="p-6">
        <SectionTitle>Overview</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {[
            { label: 'Total scrobbles', value: stats?.totalPlays ?? '—', icon: <BotIcon size={20} className="text-indigo-400" /> },
            { label: 'Users', value: stats?.totalUsers ?? '—', icon: <Users size={20} className="text-emerald-400" /> },
            { label: 'Guilds', value: (stats?.botStats as { server_count?: number } | undefined)?.server_count ?? stats?.guilds ?? '—', icon: <ShieldAlert size={20} className="text-fuchsia-400" /> },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/5">{s.icon}</div>
                <div>
                  <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold">{s.label}</div>
                  <div className="text-2xl font-black mt-1">{Number(s.value as number | string || 0).toLocaleString()}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10">
          <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-2">Bot status</div>
          <div className="text-sm">{String(stats?.statusActivity ?? 'Unknown')}</div>
          <div className="text-xs text-zinc-500 mt-1">Version: {String(stats?.currentVersion ?? 'Unknown')}</div>
        </div>
      </Card>
    ),
    users: (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Users</SectionTitle>
          <button
            onClick={() => { setNewDisplayName(''); setUserModal({ open: true, user: null }); }}
            className="px-4 py-2 rounded-xl bg-indigo-600 font-bold text-sm hover:bg-indigo-500 flex items-center gap-2"
          >
            <Plus size={14} /> Reset user
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-zinc-500">
                <th className="pb-3">User</th>
                <th className="pb-3">Last.fm</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-zinc-500">No users found.</td></tr>
              ) : (
                adminUsers.map((u) => (
                  <tr key={u.user_id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3">{u.display_name || u.discord_username || 'Unknown'}</td>
                    <td className="py-3">{u.lastfm_username || '—'}</td>
                    <td className="py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        u.is_banned ? 'bg-red-500/15 text-red-300' : u.private_mode ? 'bg-zinc-500/15 text-zinc-400' : 'bg-emerald-500/15 text-emerald-300'
                      }`}>
                        {u.is_banned ? 'Banned' : u.private_mode ? 'Private' : 'Active'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.is_banned ? (
                          <button onClick={() => handleUserAction(u.user_id, 'UNBAN')} className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-300 text-xs hover:bg-emerald-500/20">Unban</button>
                        ) : (
                          <button onClick={() => handleUserAction(u.user_id, 'BAN', { reason: '', durationHours: null })} className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-300 text-xs hover:bg-red-500/20">Ban</button>
                        )}
                        <button onClick={() => handleUserAction(u.user_id, 'RESET')} className="px-3 py-1.5 rounded-xl bg-fuchsia-500/10 text-fuchsia-300 text-xs hover:bg-fuchsia-500/20">Reset</button>
                        <button onClick={() => { setNewDisplayName(''); setUserModal({ open: true, user: u }); }} className="px-3 py-1.5 rounded-xl bg-zinc-700 text-xs hover:bg-zinc-600">Edit name</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    ),
    admins: (
      <Card className="p-6">
        <SectionTitle>Admins & Moderators</SectionTitle>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-3">Admins</div>
            <div className="space-y-2">
              {(access?.admins ?? []).length === 0 ? <p className="text-zinc-500 text-sm">None</p> : null}
              {(access?.admins ?? []).map((id) => (
                <div key={id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-sm">{id}</span>
                  <button onClick={() => removeAdmin(id)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-3">Moderators</div>
            <div className="space-y-2">
              {(access?.moderators ?? []).length === 0 ? <p className="text-zinc-500 text-sm">None</p> : null}
              {(access?.moderators ?? []).map((id) => (
                <div key={id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-sm">{id}</span>
                  <button onClick={() => removeAdmin(id)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-3">Add admin / moderator</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              value={newAdminId}
              onChange={(e) => setNewAdminId(e.target.value)}
              placeholder="Discord user ID"
              className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-sm"
            />
            <select value={newAdminRole} onChange={(e) => setNewAdminRole(e.target.value as 'admin' | 'moderator')} className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-sm">
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
            </select>
            <button onClick={addAdmin} className="px-4 py-2 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-500">Add</button>
          </div>
        </div>
      </Card>
    ),
    commands: (
      <Card className="p-6">
        <SectionTitle>Locked Commands</SectionTitle>
        <div className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(lockedCommands.length === 0 ? <p className="text-zinc-500 text-sm col-span-2">No locked commands.</p> : null)}
            {lockedCommands.map((cmd) => (
              <div key={cmd} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-sm font-mono">{cmd}</span>
                <button onClick={() => handleUnlockCommand(cmd)} className="text-xs text-emerald-400 hover:text-emerald-300">Unlock</button>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-3">Lock a command</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                value={lockCmdName}
                onChange={(e) => setLockCmdName(e.target.value)}
                placeholder="Command name"
                className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-sm"
              />
              <input
                value={lockCmdReason}
                onChange={(e) => setLockCmdReason(e.target.value)}
                placeholder="Reason"
                className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-sm"
              />
              <button onClick={handleLockCommand} className="px-4 py-2 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-500">Lock</button>
            </div>
          </div>
        </div>
      </Card>
    ),
    permissions: (
      <Card className="p-6">
        <SectionTitle>Command Permissions</SectionTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-widest text-zinc-500">
                <th className="pb-3">User ID</th>
                <th className="pb-3">Command</th>
                <th className="pb-3">Granted</th>
                <th className="pb-3">Expires</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {permissions.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-zinc-500">No permissions.</td></tr>
              ) : (
                permissions.map((p) => (
                  <tr key={`${p.user_id}-${p.command_name}`} className="border-b border-white/5">
                    <td className="py-3 text-sm font-mono">{p.user_id}</td>
                    <td className="py-3 text-sm">{p.command_name}</td>
                    <td className="py-3 text-sm">{new Date(p.granted_at).toLocaleDateString()}</td>
                    <td className="py-3 text-sm">{p.expires_at ? new Date(p.expires_at).toLocaleDateString() : 'Permanent'}</td>
                    <td className="py-3 text-right">
                      <button onClick={() => handleRemovePermission(p.user_id, p.command_name)} className="text-xs text-red-400 hover:text-red-300">Revoke</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-3">Grant permission</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input value={permUserId} onChange={(e) => setPermUserId(e.target.value)} placeholder="User ID" className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-sm" />
            <input value={permCmdName} onChange={(e) => setPermCmdName(e.target.value)} placeholder="Command name" className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-sm" />
            <select value={permDuration ?? ''} onChange={(e) => setPermDuration(e.target.value || null)} className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-sm">
              <option value="">Permanent</option>
              <option value="1h">1 hour</option>
              <option value="1d">1 day</option>
              <option value="1w">1 week</option>
              <option value="1m">1 month</option>
            </select>
            <button onClick={handleAddPermission} className="px-4 py-2 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-500">Grant</button>
          </div>
        </div>
      </Card>
    ),
    actions: (
      <Card className="p-6">
        <SectionTitle>Bot Actions</SectionTitle>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <button onClick={() => handleAdminAction('SYNC_COMMANDS')} className="w-full px-4 py-3 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-500 flex items-center gap-2">
              <RefreshCw size={14} /> Sync slash commands
            </button>
            <button onClick={() => handleAdminAction('RESTART_BOT')} className="w-full px-4 py-3 rounded-xl bg-fuchsia-500 font-bold hover:bg-fuchsia-600 flex items-center gap-2">
              <RotateCcw size={14} /> Restart bot
            </button>
            <button onClick={() => handleAdminAction('CLEAR_DUPLICATES')} className="w-full px-4 py-3 rounded-xl bg-zinc-700 font-bold hover:bg-zinc-600 flex items-center gap-2">
              <Bell size={14} /> Clear duplicates
            </button>
          </div>
          <div className="space-y-3">
            <button onClick={() => handleAdminAction('RENEW_HOST_SERVER')} className="w-full px-4 py-3 rounded-xl bg-emerald-500 font-bold hover:bg-emerald-600 flex items-center gap-2">
              <MailIcon size={14} /> Renew host server
            </button>
          </div>
        </div>
        <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-3">Set global update</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={globalVersion} onChange={(e) => setGlobalVersion(e.target.value)} placeholder="Version (e.g. v2.3.0)" className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-sm" />
            <input value={globalMessage} onChange={(e) => setGlobalMessage(e.target.value)} placeholder="Update message" className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-sm" />
            <button onClick={handleSetGlobalUpdate} className="px-4 py-2 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-500">Set</button>
          </div>
        </div>
        <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-3">Send Discord message</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={sendChannelId} onChange={(e) => setSendChannelId(e.target.value)} placeholder="Channel ID" className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-sm" />
            <input value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} placeholder="Message content" className="px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-sm" />
            <button onClick={handleSendMessage} className="px-4 py-2 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-500">Send</button>
          </div>
        </div>
      </Card>
    ),
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-fade-in">
      <h1 className="text-4xl font-black mb-6 flex items-center gap-3">
        <ShieldAlert size={32} className="text-indigo-400" /> Admin
      </h1>
      <Tabs tabs={tabs} value={tab} onChange={(v) => setTab(v as AdminTab)} />
      <div className="mt-6 space-y-6">{tabComponents[tab]}</div>

      {/* User edit modal */}
      <Dialog open={userModal.open} onClose={() => { setUserModal({ open: false, user: null }); setNewDisplayName(''); }} label="Edit user">
        <div className="bg-zinc-900 p-6 rounded-2xl border border-white/10 w-full max-w-md">
          <h2 className="font-bold mb-4">{userModal.user ? `Edit ${userModal.user.display_name || userModal.user.discord_username}` : 'Reset user'}</h2>
          {userModal.user && (
            <>
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">New display name</label>
                <input
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder={userModal.user.display_name || userModal.user.discord_username || 'Unknown'}
                  className="w-full px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleUserAction(userModal.user!.user_id, 'EDIT_NAME', { displayName: newDisplayName.trim() || null })} className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-500">Save name</button>
                <button onClick={() => handleUserAction(userModal.user!.user_id, 'RESET')} className="flex-1 px-4 py-2 rounded-xl bg-fuchsia-500 font-bold text-white hover:bg-fuchsia-600">Reset profile</button>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
}
