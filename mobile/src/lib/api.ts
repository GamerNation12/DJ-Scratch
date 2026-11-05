import type { JwtUser } from './auth';
import type { UserStats, LeaderboardEntry, Friend, RecentTrack, TopItem } from './types';
import { API_BASE } from './config';
import { getToken } from './auth';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  token: string | null,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export const api = {
  getProfile: (username: string, token: string | null, period = 'overall') =>
    request<{ stats?: UserStats }>(`/api/u/${encodeURIComponent(username)}?period=${period}`, token),
  getLeaderboard: (token: string | null) =>
    request<{ leaderboard: unknown[] }>(`/api/leaderboard`, token),
  checkAdmin: (token: string | null) =>
    request<{ role?: string }>(`/api/admin/check`, token),
  getFriends: (token: string | null) =>
    request<{ friends: Friend[] }>(`/api/friends`, token),
  friendAction: (token: string | null, body: Record<string, unknown>) =>
    request<{ success?: boolean; error?: string }>(`/api/friends`, token, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  supportChat: (token: string | null, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/support-chat`, token, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  spotifyNowPlaying: (token: string | null) =>
    request<Record<string, unknown>>(`/api/spotify/now-playing`, token),
  spotifyControl: (token: string | null, action: string | any) =>
    request(`/api/spotify/control`, token, {
      method: 'POST',
      body: JSON.stringify(typeof action === 'string' ? { action } : action),
    }),
  getSettings: (token: string | null) =>
    request<Record<string, unknown>>(`/api/settings`, token),
};
