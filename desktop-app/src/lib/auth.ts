import type { JwtUser } from './types';

const KEY = 'discord_jwt';

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  localStorage.setItem(KEY, token);
}

export function clearToken() {
  localStorage.removeItem(KEY);
}

export function decodeUser(token: string): JwtUser | null {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part)) as JwtUser;
  } catch {
    return null;
  }
}

export function canonicalUsername(name: string): string {
  return name === 'gamernation12' ? 'GamerNation12' : name;
}

export function discordAvatar(u: JwtUser): string {
  if (u.image) return u.image;
  if (u.avatar) return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`;
  return '';
}
