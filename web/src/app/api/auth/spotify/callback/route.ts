import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const urlParams = new URL(req.url).searchParams;
  const code = urlParams.get('code');
  const state = urlParams.get('state'); // This is the user_id
  const error = urlParams.get('error');

  if (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?error=spotify_auth_failed`);
  }

  if (!code || !state) {
    return new NextResponse('Missing code or state', { status: 400 });
  }

  const userId = state;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/spotify/callback`;

  if (!clientId || !clientSecret) {
    return new NextResponse('Missing Spotify Credentials', { status: 500 });
  }

  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
    },
    body: new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text();
    console.error('Spotify token error:', errorData);
    return new NextResponse('Failed to exchange token', { status: 400 });
  }

  const data = await tokenResponse.json();
  const refreshToken = data.refresh_token;

  if (refreshToken) {
    const db = getDb();
    try {
      await db`
        INSERT INTO user_settings (user_id, spotify_refresh_token) 
        VALUES (${userId}, ${refreshToken})
        ON CONFLICT (user_id) 
        DO UPDATE SET spotify_refresh_token = ${refreshToken}
      `;
    } catch (e) {
      console.error('Failed to save refresh token to DB:', e);
    }
  }

  return NextResponse.redirect(`${appUrl}/dashboard?spotify_linked=true`);
}
