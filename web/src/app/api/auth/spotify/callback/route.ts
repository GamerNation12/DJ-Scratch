import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getSpotifyRedirectUri } from '@/lib/spotify';
import { refreshLoginMessage } from '@/lib/loginRefresh';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  // state is either "<discordId>" or "<discordId>:<channelId>:<messageId>".
  const [discordId, channelId, messageId] = (searchParams.get('state') || '').split(':');
  
  if (!code || !discordId) {
    return NextResponse.json({ error: 'Missing code or state parameter' }, { status: 400 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = getSpotifyRedirectUri();

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

    // Refresh the Discord login message if this link started there.
    try {
      const origin = new URL(req.url).origin;
      await refreshLoginMessage({ channelId, messageId, userId: discordId, siteOrigin: origin });
    } catch (e) {
      console.error('Failed to refresh login message:', e);
    }

    // Give the user a nice success page (site-styled, no dead features).
    const discordUpdated = !!(channelId && messageId);
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Spotify Linked!</title>
          <style>
              * { box-sizing: border-box; }
              body {
                  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
                  background-color: #09090b;
                  color: white;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  margin: 0;
                  padding: 24px;
              }
              .card {
                  background: rgba(24, 24, 27, 0.6);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  padding: 40px 48px;
                  border-radius: 24px;
                  text-align: center;
                  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
                  max-width: 520px;
                  width: 100%;
              }
              .badge {
                  width: 72px; height: 72px;
                  margin: 0 auto 20px;
                  border-radius: 9999px;
                  background: rgba(34, 197, 94, 0.15);
                  border: 1px solid rgba(34, 197, 94, 0.3);
                  display: flex; align-items: center; justify-content: center;
                  font-size: 32px;
              }
              h1 { color: #4ade80; margin: 0 0 12px; font-size: 28px; font-weight: 800; }
              p { color: #d4d4d8; margin: 8px 0; }
              ul { list-style: none; padding: 0; margin: 20px 0 0; display: inline-block; text-align: left; }
              li { color: #a1a1aa; margin: 6px 0; font-size: 15px; }
              li span { color: #4ade80; font-weight: bold; margin-right: 8px; }
              .actions { margin-top: 28px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
              .btn {
                  display: inline-block; padding: 12px 24px; border-radius: 12px;
                  font-weight: bold; font-size: 15px; text-decoration: none;
                  transition: filter 0.15s;
              }
              .btn:hover { filter: brightness(1.1); }
              .btn-primary { background: #22c55e; color: #000; box-shadow: 0 0 20px rgba(34, 197, 94, 0.35); }
              .btn-ghost { background: rgba(255,255,255,0.05); color: #e4e4e7; border: 1px solid rgba(255,255,255,0.1); }
              .fine { color: #71717a; font-size: 13px; margin-top: 20px; }
          </style>
      </head>
      <body>
          <div class="card">
              <div class="badge">🎵</div>
              <h1>Spotify Successfully Linked!</h1>
              <p>Your Spotify account is now connected to DJ Scratch.</p>
              <ul>
                  <li><span>✓</span>Control playback from Discord with ,rc</li>
                  <li><span>✓</span>Like songs and use the Music dashboard</li>
                  <li><span>✓</span>Richer now-playing artwork and links</li>
              </ul>
              <div class="actions">
                  <a class="btn btn-primary" href="/music">Open Music Dashboard</a>
                  <a class="btn btn-ghost" href="javascript:window.close()">Close Window</a>
              </div>
              <p class="fine">${discordUpdated ? "Your Discord login message was updated too. " : ""}You can safely close this window and return to Discord.</p>
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
