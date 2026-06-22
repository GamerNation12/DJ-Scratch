import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const urlParams = new URL(req.url).searchParams;
  const userId = urlParams.get('user_id');

  if (!userId) {
    return new NextResponse('Missing user_id', { status: 400 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return new NextResponse('Missing SPOTIFY_CLIENT_ID', { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://the-goats-dj.vercel.app';
  const redirectUri = encodeURIComponent(`${appUrl}/api/auth/spotify/callback`);
  const scope = encodeURIComponent('user-modify-playback-state user-read-playback-state user-library-modify');
  const state = encodeURIComponent(userId);
  
  const url = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
  
  return NextResponse.redirect(url);
}
