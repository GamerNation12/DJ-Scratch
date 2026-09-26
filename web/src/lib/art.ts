/** Artwork URLs routed through our same-origin image proxy.
 *
 * Hotlinked CDN art (Deezer, Last.fm image hosts) breaks inside the Discord
 * Activity (origin/referer restrictions) while working fine on the website.
 * Same-origin proxy responses load everywhere. Discord CDN avatars and local
 * paths are left untouched.
 */
const DIRECT_HOSTS = ["cdn.discordapp.com"];

const PROXYABLE_HOSTS = [
  "cdn-images.dzcdn.net",
  "e-cdn-images.dzcdn.net",
  "lastfm-img.freetls.fastly.net",
  "lastfm.freetls.fastly.net",
  "img2-ak.last.fm",
  "ws.audioscrobbler.com",
  "api.deezer.com",
  ...DIRECT_HOSTS,
];

export function isProxyableArtwork(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url, "https://dj-scratch.vercel.app").hostname.toLowerCase();
    return PROXYABLE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function artSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/") || url.startsWith("data:")) return url;
  const https = url.startsWith("http://") ? `https://${url.slice("http://".length)}` : url;
  try {
    const host = new URL(https).hostname.toLowerCase();
    if (DIRECT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      return https;
    }
  } catch {
    return undefined;
  }
  return `/api/proxy-image?url=${encodeURIComponent(https)}`;
}
