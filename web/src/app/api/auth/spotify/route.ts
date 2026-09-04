import { NextResponse } from 'next/server';
import { getSpotifyRedirectUri } from '@/lib/spotify';

export async function GET(req: Request) {
  const urlParams = new URL(req.url).searchParams;
  const userId = urlParams.get('user_id');

  if (!userId) {
    return new NextResponse('Missing user_id', { status: 400 });
  }

  // Optional Discord message context (bot login buttons): packed into state
  // so the callback can refresh the original `,login` message on success.
  const channelId = urlParams.get('channel_id');
  const messageId = urlParams.get('message_id');

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return new NextResponse('Missing SPOTIFY_CLIENT_ID', { status: 500 });
  }

  const redirectUri = encodeURIComponent(getSpotifyRedirectUri());
  // Same set as /api/auth/spotify/login so both entry points grant identical access.
  const scope = encodeURIComponent('user-read-currently-playing user-read-playback-state user-modify-playback-state user-library-read user-library-modify');
  const state = encodeURIComponent(
    channelId && messageId ? `${userId}:${channelId}:${messageId}` : userId
  );
  
  const url = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
  
  return NextResponse.redirect(url);
}
