import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_HOSTS = [
  "cdn-images.dzcdn.net",
  "e-cdn-images.dzcdn.net",
  "lastfm-img.freetls.fastly.net",
  "lastfm.freetls.fastly.net",
  "img2-ak.last.fm",
  "ws.audioscrobbler.com",
  "api.deezer.com",
  "cdn.discordapp.com",
];

function allowed(raw: string): string | null {
  let url = (raw || "").trim();
  if (!url) return null;
  // Upgrade sloppy http artwork to https (mixed-content is blocked).
  if (url.startsWith("http://")) url = `https://${url.slice("http://".length)}`;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return null;
  }
  return url;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = allowed(searchParams.get('url') || '');

  if (!url) {
    return new NextResponse('Bad artwork host', { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "DJScratch/1.0 (+https://dj-scratch.vercel.app)" },
    });
    if (!res.ok) {
      return new NextResponse('Error fetching image', { status: res.status });
    }
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) {
      return new NextResponse('Not an image', { status: 415 });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': type.split(";")[0] || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return new NextResponse('Error proxying image', { status: 500 });
  }
}
