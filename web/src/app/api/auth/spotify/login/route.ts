import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const discordId = searchParams.get('discord_id');
  
  if (!discordId) {
    return NextResponse.json({ error: 'Missing discord_id parameter' }, { status: 400 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_BASE_URL 
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/spotify/callback` 
    : 'https://dj-scratch.vercel.app/api/auth/spotify/callback';

  if (!clientId) {
    return NextResponse.json({ error: 'SPOTIFY_CLIENT_ID is not configured' }, { status: 500 });
  }

  const scope = 'user-read-currently-playing user-read-playback-state';
  // We pass the discordId in the state parameter so we know who to save the token for!
  const state = discordId;

  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('scope', scope);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('state', state);

  return NextResponse.redirect(authUrl.toString());
}
