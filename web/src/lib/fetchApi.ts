export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('discord_jwt') : null;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });
}
