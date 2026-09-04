import { NextResponse } from 'next/server';
import { getSpotifyRedirectUri } from '@/lib/spotify';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const discordId = searchParams.get('discord_id');

  if (!discordId) {
    return NextResponse.json({ error: 'Missing discord_id parameter' }, { status: 400 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = getSpotifyRedirectUri();

  if (!clientId) {
    return NextResponse.json({ error: 'SPOTIFY_CLIENT_ID is not configured' }, { status: 500 });
  }

  // Read scopes power now-playing display; modify/library scopes power the
  // Music page remote (play/pause/skip) and likes. Request all up front so
  // users never need to re-link to unlock a button.
  const scope = [
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-library-read',
    'user-library-modify',
  ].join(' ');
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
