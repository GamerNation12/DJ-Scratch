import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const apiKey = process.env.LASTFM_API_KEY || "696438a21fc540d4cb27faa736239e75";
  const { host } = new URL(request.url);
  const baseUrl = host.includes('localhost') ? `http://${host}` : `https://${host}`;
  const callbackUrl = encodeURIComponent(`${baseUrl}/api/auth/lastfm/callback`);
  
  const lastFmAuthUrl = `http://www.last.fm/api/auth/?api_key=${apiKey}&cb=${callbackUrl}`;
  
  return NextResponse.redirect(lastFmAuthUrl);
}
