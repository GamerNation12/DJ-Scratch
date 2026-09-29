import { API_BASE } from './config';
import type { RhythmData, UserStats } from './types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status);
  return data as T;
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent?: number;
}

export type SpotifyControlBody =
  | { action: 'play' | 'pause' | 'next' | 'previous' }
  | { action: 'shuffle'; state: boolean }
  | { action: 'repeat'; state: 'track' | 'context' | 'off' }
  | { action: 'volume'; volume: number }
  | { action: 'seek'; position_ms: number }
  | { action: 'transfer'; device_id: string; play: boolean };

export const api = {
  getProfile: (username: string, token: string | null, period = 'overall') =>
    request<{ stats?: UserStats; rhythm?: RhythmData }>(`/api/u/${encodeURIComponent(username)}?period=${period}`, token),
  getLeaderboard: (token: string | null) =>
    request<{ leaderboard: unknown[] }>(`/api/leaderboard`, token),
  checkAdmin: (token: string | null) =>
    request<{ role?: string }>(`/api/admin/check`, token),
  getAdminStats: (token: string | null) =>
    request<Record<string, unknown>>(`/api/admin/stats`, token),
  getFriends: (token: string | null) =>
    request<{ friends: unknown[] }>(`/api/friends`, token),
  friendAction: (token: string | null, body: Record<string, unknown>) =>
    request<{ success?: boolean; error?: string }>(`/api/friends`, token, { method: 'POST', body: JSON.stringify(body) }),
  spotifyNowPlaying: (token: string | null) =>
    request<Record<string, unknown>>(`/api/spotify/now-playing`, token),
  spotifyControl: (token: string | null, action: string | SpotifyControlBody) =>
    request(`/api/spotify/control`, token, {
      method: 'POST',
      body: JSON.stringify(typeof action === 'string' ? { action } : action),
    }),
  spotifyDevices: (token: string | null) =>
    request<{ devices: SpotifyDevice[] }>(`/api/spotify/devices`, token),
  spotifyLike: (token: string | null, id: string, action: 'like' | 'unlike') =>
    request(`/api/spotify/like`, token, { method: 'POST', body: JSON.stringify({ id, action }) }),
  supportChat: (token: string | null, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/support-chat`, token, { method: 'POST', body: JSON.stringify(body) }),
  toolsWhoKnows: (token: string | null, params: { kind: string; artist?: string; track?: string; album?: string }) => {
    const q = new URLSearchParams({ kind: params.kind });
    if (params.artist) q.set('artist', params.artist);
    if (params.track) q.set('track', params.track);
    if (params.album) q.set('album', params.album);
    return request<Record<string, unknown>>(`/api/tools/whoknows?${q.toString()}`, token);
  },
  toolsPace: (token: string | null, params: { user?: string; goal?: string }) => {
    const q = new URLSearchParams();
    if (params.user) q.set('user', params.user);
    if (params.goal) q.set('goal', params.goal);
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return request<Record<string, unknown>>(`/api/tools/pace${suffix}`, token);
  },
  toolsTaste: (token: string | null, a: string, b: string) => {
    const q = new URLSearchParams({ a, b });
    return request<Record<string, unknown>>(`/api/tools/taste?${q.toString()}`, token);
  },
  toolsAutocomplete: (token: string | null, kind: string, q: string) => {
    const params = new URLSearchParams({ kind, q });
    return request<{ suggestions: Array<{ name: string; artist?: string; image?: string }> }>(
      `/api/tools/autocomplete?${params.toString()}`,
      token
    );
  },
  getSettings: (token: string | null) =>
    request<{
      fmMode?: string;
      showFeatures?: boolean;
      privateMode?: boolean;
      dataSource?: string;
      timezone?: string;
      showTrackPlaycount?: boolean;
      displayName?: string;
    }>(`/api/settings`, token),
  saveSettings: (token: string | null, body: Record<string, unknown>) =>
    request(`/api/settings`, token, { method: 'POST', body: JSON.stringify(body) }),
  spotifyStatus: (token: string | null) =>
    request<{ linked?: boolean }>(`/api/spotify/status`, token),
  spotifyDisconnect: (token: string | null) =>
    request(`/api/spotify/disconnect`, token, { method: 'POST', body: JSON.stringify({}) }),
};
