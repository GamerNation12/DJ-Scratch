import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const discordId = searchParams.get('state');
  
  if (!code || !discordId) {
    return NextResponse.json({ error: 'Missing code or state parameter' }, { status: 400 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.NEXT_PUBLIC_BASE_URL 
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/spotify/callback` 
    : 'https://dj-scratch.vercel.app/api/auth/spotify/callback';

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Spotify credentials are not configured' }, { status: 500 });
  }

  try {
    // Exchange the code for an access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Spotify token error:', tokenData);
      return NextResponse.json({ error: 'Failed to fetch Spotify token' }, { status: 500 });
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Save to PostgreSQL database
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    });

    await pool.query(
      `INSERT INTO user_settings (user_id, spotify_access_token, spotify_refresh_token, spotify_token_expires_at) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         spotify_access_token = $2, 
         spotify_refresh_token = $3, 
         spotify_token_expires_at = $4`,
      [discordId, access_token, refresh_token, expiresAt]
    );

    await pool.end();

    // Give the user a nice success page
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Spotify Linked!</title>
          <style>
              body {
                  font-family: 'Inter', sans-serif;
                  background-color: #121212;
                  color: white;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
              }
              .card {
                  background-color: #181818;
                  padding: 40px;
                  border-radius: 12px;
                  text-align: center;
                  box-shadow: 0 8px 16px rgba(0,0,0,0.5);
              }
              h1 {
                  color: #1DB954;
              }
          </style>
      </head>
      <body>
          <div class="card">
              <h1>Spotify Successfully Linked! 🎵</h1>
              <p>Your Spotify account is now connected to DJ Scratch.</p>
              <p>The Karaoke Lyrics teleprompter will now perfectly auto-sync!</p>
              <p style="color: #888; font-size: 0.9em; margin-top: 20px;">You can close this window and return to Discord.</p>
          </div>
      </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Error in Spotify callback:', error);
    return NextResponse.json({ error: 'Internal server error during callback' }, { status: 500 });
  }
}
