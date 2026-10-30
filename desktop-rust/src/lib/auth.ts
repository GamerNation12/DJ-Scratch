export type JwtUser = {
  id: string;
  name: string;
  avatar?: string;
  image?: string;
  [k: string]: unknown;
};

export const KEY = 'dj_scratch_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {}
}

export function clearToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
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
