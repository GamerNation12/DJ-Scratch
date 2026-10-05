// Server-only helper for upstream API calls (Last.fm, Deezer, iTunes,
// Discord). Two guarantees the raw fetch() doesn't give:
//  1. Hard timeout — a hung upstream fails fast instead of hanging the
//     route until Vercel returns a 504 HTML page.
//  2. Shared cache — identical URLs reuse one response across requests,
//     so polling clients can't stampede the upstreams (or the DB behind
//     routes that fan out per request).
export function upstreamFetch(url: string, revalidateSeconds = 120, timeoutMs = 10000) {
  return fetch(url, {
    next: { revalidate: revalidateSeconds },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function upstreamJson(url: string, revalidateSeconds = 120, timeoutMs = 10000) {
  try {
    const res = await upstreamFetch(url, revalidateSeconds, timeoutMs);
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}
