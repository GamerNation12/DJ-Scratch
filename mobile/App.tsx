import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
  ImageBackground,
  TextInput,
} from 'react-native';
import { Home, Trophy, Users, Shield, Settings, LifeBuoy, LogOut, RotateCcw, Send, Mail, Wrench } from 'lucide-react-native';
import { colors, Card, SectionTitle, Spinner, Empty, Bubble } from './src/components/ui';
import { api } from './src/lib/api';
import { canonicalUsername, clearToken, decodeUser, discordAvatar, getToken, setToken } from './src/lib/auth';
import type { JwtUser } from './src/lib/auth';

const ICON_SIZE = 22;

type Tab = 'dashboard' | 'leaderboard' | 'friends' | 'tools' | 'support' | 'admin' | 'settings';

const NAV: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'friends', label: 'Friends', icon: Users },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'support', label: 'Support', icon: LifeBuoy },
  { id: 'admin', label: 'Admin', icon: Shield },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const PERIODS = [
  { value: '7day', label: '7 days' },
  { value: '1month', label: '1 month' },
  { value: '3month', label: '3 months' },
  { value: '6month', label: '6 months' },
  { value: '12month', label: '12 months' },
  { value: 'overall', label: 'Overall' },
];

export default function App() {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<JwtUser | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [isAdmin, setIsAdmin] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const t = getToken();
    setTokenState(t);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    const u = decodeUser(token);
    if (!u) {
      clearToken();
      setTokenState(null);
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
    setTokenState(null);
    setUser(null);
    setTab('dashboard');
  };

  if (!token || !user) return <LoginScreen onLogin={(t) => { setTokenState(t); }} />;

  const username = canonicalUsername(user.name);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <View style={styles.sidebar}>
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            {discordAvatar(user) ? (
              <ImageBackground source={{ uri: discordAvatar(user) }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.indigo }]}>
                <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
          <Text style={styles.username}>{username}</Text>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: online ? colors.emerald : colors.red }]} />
            <Text style={styles.statusText}>{online ? 'Online' : 'Offline'}</Text>
          </View>
        </View>
        <View style={styles.nav}>
          {NAV.filter((n) => n.id !== 'admin' || isAdmin).map((n) => {
            const Icon = n.icon;
            return (
              <TouchableOpacity
                key={n.id}
                onPress={() => setTab(n.id)}
                style={[styles.navItem, tab === n.id && styles.navItemActive]}
              >
                <Icon size={ICON_SIZE} color={tab === n.id ? colors.indigo : colors.textMuted} />
                <Text style={[styles.navLabel, tab === n.id && styles.navLabelActive]}>{n.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.spacer} />
        <TouchableOpacity onPress={logout} style={styles.navItem}>
          <LogOut size={ICON_SIZE} color={colors.red} />
          <Text style={[styles.navLabel, { color: colors.red }]}>Logout</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {tab === 'dashboard' && <DashboardPage token={token} username={username} />}
        {tab === 'leaderboard' && <LeaderboardPage token={token} />}
        {tab === 'friends' && <FriendsPage token={token} />}
        {tab === 'tools' && <ToolsPage />}
        {tab === 'support' && <SupportPage token={token} />}
        {tab === 'admin' && <AdminPage />}
        {tab === 'settings' && <SettingsPage token={token} user={user} onLogout={logout} />}
      </View>
    </SafeAreaView>
  );
}

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('https://api.djscratch.app/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setToken(data.token);
      onLogin(data.token);
    } catch (err) {
      Alert.alert('Login failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.loginContainer}>
      <Card style={styles.loginCard}>
        <Text style={styles.loginTitle}>DJ Scratch</Text>
        <Text style={styles.loginSub}>Log in to continue</Text>
        <form onSubmit={handleLogin} style={styles.loginForm}>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
          />
          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
          >
            <Text style={styles.loginButtonText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
          </TouchableOpacity>
        </form>
      </Card>
    </View>
  );
}

const DashboardPage = memo(({ token, username }: { token: string; username: string }) => {
  const [stats, setStats] = useState<any>(null);
  const [period, setPeriod] = useState<string>('overall');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProfile(username, token, period)
      .then((d) => { setStats(d.stats ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, username, period]);

  return (
    <View style={styles.page}>
      <Text style={styles.pageTitle}>Dashboard</Text>
      <Text style={styles.pageSub}>Welcome back, {username}.</Text>
      <View style={styles.periodBar}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            onPress={() => setPeriod(p.value)}
            style={[styles.periodChip, period === p.value && styles.periodChipActive]}
          >
            <Text style={[styles.periodChipText, period === p.value && styles.periodChipTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <Spinner label="Loading stats…" /> : (
        <Card>
          <SectionTitle>Your Stats</SectionTitle>
          {stats?.playcount != null ? (
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Total Scrobbles</Text>
              <Text style={styles.statValue}>{Number(stats.playcount).toLocaleString()}</Text>
            </View>
          ) : (
            <Empty title="No stats yet" hint="Connect Last.fm and start listening." />
          )}
        </Card>
      )}
    </View>
  );
});

const LeaderboardPage = memo(({ token }: { token: string }) => {
  const [lb, setLb] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLeaderboard(token)
      .then((d) => { setLb(d.leaderboard ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  return (
    <View style={styles.page}>
      <Text style={styles.pageTitle}>Leaderboard</Text>
      {loading ? <Spinner label="Loading leaderboard…" /> : (
        <Card>
          <SectionTitle>Top Listeners</SectionTitle>
          {lb.length === 0 ? <Empty title="No leaderboard data" /> : (
            <View style={styles.list}>
              {lb.slice(0, 20).map((e, i) => (
                <TouchableOpacity key={i} style={styles.listItem}>
                  <View style={styles.listItemRank}>{i + 1}</View>
                  {e.avatar ? (
                    <ImageBackground source={{ uri: e.avatar }} style={styles.listItemAvatar} />
                  ) : (
                    <View style={[styles.listItemAvatar, { backgroundColor: colors.indigo }]}>
                      <Text style={styles.listItemAvatarText}>{String(e.username).charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.listItemBody}>
                    <Text style={styles.listItemName}>{e.username}</Text>
                    <Text style={styles.listItemValue}>{e.playcount != null ? Number(e.playcount).toLocaleString() : '—'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>
      )}
    </View>
  );
});

const FriendsPage = memo(({ token }: { token: string }) => {
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFriends(token)
      .then((d) => { setFriends(d.friends ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  return (
    <View style={styles.page}>
      <Text style={styles.pageTitle}>Friends</Text>
      {loading ? <Spinner label="Loading friends…" /> : (
        <Card>
          <SectionTitle>Your Friends</SectionTitle>
          {friends.length === 0 ? <Empty title="No friends yet" /> : (
            <View style={styles.list}>
              {friends.map((f) => (
                <TouchableOpacity key={f.friend_id} style={styles.listItem}>
                  <View style={styles.listItemStatusPill}>
                    <View style={[styles.statusDot, { backgroundColor: f.status === 'accepted' ? colors.emerald : colors.textMuted }]} />
                    <Text style={styles.listItemStatusText}>{f.status}</Text>
                  </View>
                  <View style={styles.listItemBody}>
                    <Text style={styles.listItemName}>{f.friend_username}</Text>
                    {f.display_name && <Text style={styles.listItemValue}>{f.display_name}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>
      )}
    </View>
  );
});

const ToolsPage = memo(() => (
  <View style={styles.page}>
    <Text style={styles.pageTitle}>Tools</Text>
    <Text style={styles.pageSub}>Desktop tools coming soon.</Text>
  </View>
));

const AdminPage = memo(() => (
  <View style={styles.page}>
    <Text style={styles.pageTitle}>Admin</Text>
    <Text style={styles.pageSub}>Admin panel coming soon.</Text>
  </View>
));

const SettingsPage = memo(({ token, user, onLogout }: { token: string; user: JwtUser; onLogout: () => void }) => (
  <View style={styles.page}>
    <Text style={styles.pageTitle}>Settings</Text>
    <Card>
      <SectionTitle>Account</Text>
      <View style={styles.settingsRow}>
        <Text style={styles.settingsLabel}>Username</Text>
        <Text style={styles.settingsValue}>{user.name}</Text>
      </View>
      <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
        <Text style={styles.logoutButtonText}>Log out</Text>
      </TouchableOpacity>
    </Card>
  </View>
));

const SupportPage = memo(({ token }: { token: string }) => {
  const [thread, setThread] = useState<{ threadId: string; secret: string } | null>(null);
  const [messages, setMessages] = useState<{ id: string; mine: boolean; text: string; at: string }[]>([]);
  const [status, setStatus] = useState<string>('open');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [name, setName] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [starting, setStarting] = useState(false);

  const renderBubbles = (msgs: typeof messages) => (
    <>
      {msgs.length === 0 ? (
        <Text style={styles.emptyTitle}>No messages yet — say hello below.</Text>
      ) : (
        msgs.map((m) => <Bubble key={m.id} text={m.text} mine={m.mine} at={m.at} />)
      )}
    </>
  );

  const poll = useCallback(async () => {
    if (!thread) return;
    try {
      const data = await api.supportChat(token, {
        action: 'poll',
        threadId: thread.threadId,
        secret: thread.secret,
      });
      const incoming = (data.messages ?? []).map((m: any, i: number) => ({
        id: String(m.id ?? i),
        mine: ['guest', 'user', 'visitor', 'me'].includes(String(m.role ?? m.from ?? '').toLowerCase()),
        text: String(m.text ?? m.content ?? m.body ?? ''),
        at: String(m.created_at ?? m.createdAt ?? m.at ?? ''),
      }));
      setMessages((prev) => {
        const seen = new Set(incoming.map((m) => m.id));
        return [...incoming, ...prev.filter((m) => !seen.has(m.id))];
      });
      setStatus(String(data.status ?? 'open'));
    } catch {}
  }, [thread, token]);

  useEffect(() => {
    if (!thread) return;
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [thread, poll]);

  const start = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!name.trim() || !firstMessage.trim()) {
      Alert.alert('Missing info', 'Please add your name and a message.');
      return;
    }
    setStarting(true);
    try {
      const data = await api.supportChat(token, {
        action: 'start',
        name: name.trim(),
        email: '',
        message: firstMessage.trim(),
        content: firstMessage.trim(),
      });
      const threadId = String(data.threadId ?? data.thread_id ?? data.id ?? '');
      const secret = String(data.secret ?? data.token ?? '');
      if (!threadId || !secret) throw new Error('Could not start chat.');
      setThread({ threadId, secret });
      setMessages([{ id: 'local-0', mine: true, text: firstMessage.trim(), at: '' }]);
      setStatus(String(data.status ?? 'open'));
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not start chat.');
    } finally {
      setStarting(false);
    }
  };

  const send = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!input.trim() || !thread || sending || status === 'closed') return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      await api.supportChat(token, {
        action: 'send',
        threadId: thread.threadId,
        secret: thread.secret,
        message: text,
        content: text,
      });
      setMessages((m) => [...m, { id: `local-${Date.now()}`, mine: true, text, at: '' }]);
      await poll();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send');
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setThread(null);
    setMessages([]);
    setStatus('open');
    setInput('');
  };

  const closed = status.toLowerCase() === 'closed';

  if (!thread) {
    return (
      <View style={styles.page}>
        <Text style={styles.pageTitle}>Support</Text>
        <Text style={styles.pageSub}>Chat with the team — replies appear here live.</Text>
        <Card>
          <form onSubmit={start} style={styles.supportForm}>
            <Text style={styles.fieldLabel}>Your Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
            />
            <Text style={styles.fieldLabel}>Message</Text>
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              multiline
              numberOfLines={4}
              value={firstMessage}
              onChangeText={setFirstMessage}
              placeholder="How can we help?"
            />
            <TouchableOpacity
              onPress={start}
              disabled={starting}
              style={[styles.loginButton, starting && styles.loginButtonDisabled]}
            >
              <Send size={16} style={styles.sendIcon} />
              <Text style={styles.loginButtonText}>{starting ? 'Starting…' : 'Start chat'}</Text>
            </TouchableOpacity>
          </form>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.supportHeader}>
        <Text style={styles.pageTitle}>Support Chat</Text>
        <TouchableOpacity onPress={reset} style={styles.newChatButton}>
          <RotateCcw size={16} style={styles.sendIcon} />
          <Text style={styles.navLabelActive}>New chat</Text>
        </TouchableOpacity>
      </View>
      <Card style={styles.supportCard}>
        <View style={styles.supportStatusBar}>
          <View style={[styles.statusDot, { backgroundColor: closed ? colors.textMuted : colors.emerald }]} />
          <Text style={styles.statusText}>{closed ? 'Closed' : 'Open'}</Text>
          <Text style={styles.statusTextRight}>Replies refresh live</Text>
        </View>
        <View style={styles.messagesContainer}>
          {renderBubbles(messages)}
        </View>
        {closed ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>This chat is closed.</Text>
            <TouchableOpacity onPress={reset} style={styles.newChatButton}>
              <Text style={styles.loginButtonText}>Start a new chat</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputBar}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={input}
              onChangeText={setInput}
              placeholder="Type your reply…"
            />
            <TouchableOpacity
              onPress={send}
              disabled={!input.trim() || sending}
              style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
            >
              <Send size={18} style={styles.sendIcon} />
            </TouchableOpacity>
          </View>
        )}
      </Card>
    </View>
  );
});

const styles = {
  container: { flex: 1, backgroundColor: colors.bg },
  sidebar: {
    width: 90,
    backgroundColor: '#111113',
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingTop: Platform.OS === 'ios' ? 44 : 0,
    paddingBottom: 12,
  },
  header: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    gap: 8,
    alignItems: 'center',
  },
  avatarWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  username: { fontSize: 15, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700', color: colors.text },
  nav: { paddingHorizontal: 6, gap: 4 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderRightWidth: 3,
    borderRightColor: colors.indigo,
  },
  navLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginLeft: 2 },
  navLabelActive: { color: colors.indigo },
  spacer: { flex: 1 },
  content: { flex: 1, padding: 16 },
  page: { flex: 1 },
  pageTitle: { fontSize: 26, fontWeight: '900', color: colors.text, marginBottom: 4, letterSpacing: -0.5 },
  pageSub: { fontSize: 13, color: colors.textMuted, marginBottom: 16 },
  periodBar: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  periodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodChipActive: {
    backgroundColor: colors.indigo,
    borderColor: colors.indigo,
  },
  periodChipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  periodChipTextActive: { color: '#fff' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  statLabel: { fontSize: 13, color: colors.textMuted },
  statValue: { fontSize: 15, fontWeight: '800', color: colors.text },
  list: { gap: 8 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listItemRank: { width: 24, fontSize: 13, fontWeight: '900', color: colors.textDim },
  listItemAvatar: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden' },
  listItemAvatarText: { color: '#fff', fontWeight: '800', fontSize: 13, textAlign: 'center', lineHeight: 32 },
  listItemBody: { flex: 1 },
  listItemName: { fontSize: 14, fontWeight: '800', color: colors.text },
  listItemValue: { fontSize: 12, color: colors.textMuted },
  listItemStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  listItemStatusText: { fontSize: 10, fontWeight: '800', color: colors.textDim },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsLabel: { fontSize: 14, color: colors.textMuted },
  settingsValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  logoutButton: {
    marginTop: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutButtonText: { fontSize: 14, fontWeight: '800', color: colors.red },
  supportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  supportCard: { flex: 1 },
  supportStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusTextRight: { fontSize: 11, color: colors.textDim, marginLeft: 'auto' },
  messagesContainer: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  inputBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  supportForm: { gap: 10 },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  sendIcon: { color: colors.textMuted },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: colors.textDim, opacity: 0.5 },
  loginContainer: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loginCard: { width: '100%', maxWidth: 340, padding: 24 },
  loginTitle: { fontSize: 28, fontWeight: '900', color: colors.text, textAlign: 'center', marginBottom: 4, letterSpacing: -0.5 },
  loginSub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 24 },
  loginForm: { gap: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: colors.textMuted, marginBottom: 4 },
  loginButton: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.indigo,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    marginHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
  },
};
