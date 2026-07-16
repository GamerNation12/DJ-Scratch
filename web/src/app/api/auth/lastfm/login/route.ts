import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const apiKey = process.env.LASTFM_API_KEY || "eee299142ac5fe73e5eb5dcd1c29bcae";
  const { host } = new URL(request.url);
  const baseUrl = host.includes('localhost') ? `http://${host}` : `https://${host}`;
  const callbackUrl = encodeURIComponent(`${baseUrl}/api/auth/lastfm/callback`);
  
  const lastFmAuthUrl = `http://www.last.fm/api/auth/?api_key=${apiKey}&cb=${callbackUrl}`;
  
  return NextResponse.redirect(lastFmAuthUrl);
}
