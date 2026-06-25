import { NextResponse } from 'next/server';
import { signToken } from '@/lib/jwt';
import postgres from 'postgres';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=NoCode', request.url));
  }

  const clientId = process.env.DISCORD_CLIENT_ID!;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET!;
  const redirectUri = `${'https://the-goats-dj.vercel.app'}/api/auth/callback`;

  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    return NextResponse.redirect(new URL('/?error=TokenFailed', request.url));
  }

  const userResponse = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const userData = await userResponse.json();

  const username = userData.username === "gamernation12" ? "GamerNation12" : userData.username;
  const jwt = await signToken({
    id: userData.id,
    name: username,
    email: userData.email,
    image: `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`,
  });

  // Log the login
  try {
    const sql = postgres(process.env.DATABASE_URL || process.env.POSTGRES_URL || "");
    await sql`CREATE TABLE IF NOT EXISTS website_logs (id SERIAL PRIMARY KEY, user_id TEXT, username TEXT, action TEXT, details TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    await sql`
      INSERT INTO website_logs (user_id, username, action, details)
      VALUES (${userData.id}, ${username}, 'Website Login', 'User logged into dashboard')
    `;

    // Also link their discord username to their settings if it doesn't exist yet
    await sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS discord_username TEXT`;
    await sql`
      INSERT INTO user_settings (user_id, discord_username) 
      VALUES (${userData.id}, ${username})
      ON CONFLICT (user_id) DO UPDATE SET discord_username = EXCLUDED.discord_username
    `;
    await sql`
      DELETE FROM website_logs 
      WHERE id NOT IN (
        SELECT id FROM website_logs ORDER BY timestamp DESC LIMIT 200
      )
    `;
  } catch (e) {
    console.error("Failed to log website login:", e);
  }

  const state = searchParams.get('state');
  if (state === 'mobile') {
    const rawUrl = `thegoatsdj://auth?token=${jwt}`;
    const intentUrl = `intent://auth?token=${jwt}#Intent;scheme=thegoatsdj;package=com.gamernation.the_goats_dj;end`;
    
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Redirecting...</title>
          <script>
            window.onload = function() {
              // Try intent URL first for Android, fallback to raw custom scheme for iOS
              var isAndroid = /android/i.test(navigator.userAgent || navigator.vendor || window.opera);
              window.location.href = isAndroid ? "${intentUrl}" : "${rawUrl}";
            }
          </script>
          <style>
            body { background: #111; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            a { color: #00f0ff; text-decoration: none; padding: 10px 20px; border: 1px solid #00f0ff; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h2>Login Successful!</h2>
          <p>Redirecting back to the app...</p>
          <a href="#" onclick="var isAndroid = /android/i.test(navigator.userAgent || navigator.vendor || window.opera); window.location.href = isAndroid ? '${intentUrl}' : '${rawUrl}'; return false;">Click here if nothing happens</a>
        </body>
      </html>
    `;
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  return NextResponse.redirect(new URL(`/logging-in#token=${jwt}`, request.url));
}
