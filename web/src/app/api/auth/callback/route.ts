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

  const state = searchParams.get('state');
  const isMobile = state === 'mobile';
  const actionName = isMobile ? 'Mobile App Login' : 'Website Login';
  const actionDetails = isMobile ? 'User logged into the mobile app' : 'User logged into dashboard';

  // Log the login
  try {
    const sql = postgres(process.env.DATABASE_URL || process.env.POSTGRES_URL || "");
    await sql`CREATE TABLE IF NOT EXISTS website_logs (id SERIAL PRIMARY KEY, user_id TEXT, username TEXT, action TEXT, details TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    await sql`
      INSERT INTO website_logs (user_id, username, action, details)
      VALUES (${userData.id}, ${username}, ${actionName}, ${actionDetails})
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

  if (isMobile) {
    const appUrl = `thegoatsdj://auth?token=${jwt}`;
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Login Successful</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { background-color: #09090b; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          a { background-color: #5865F2; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px; }
        </style>
        <script>
          window.onload = function() {
            window.location.href = "${appUrl}";
          }
        </script>
      </head>
      <body>
        <h2>Login Successful!</h2>
        <p>Returning you to the app...</p>
        <a href="${appUrl}">Click here if nothing happens</a>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  return NextResponse.redirect(new URL(`/logging-in#token=${jwt}`, request.url));
}
