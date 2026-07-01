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
  const { host } = new URL(request.url);
  const baseUrl = host.includes('localhost') ? `http://${host}` : `https://${host}`;
  const redirectUri = `${baseUrl}/api/auth/callback`;

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
  console.log("Discord Token Exchange Result:", tokenData);

  if (!tokenData.access_token) {
    const errorMsg = encodeURIComponent(tokenData.error_description || tokenData.error || 'Unknown_Discord_Error');
    return NextResponse.redirect(new URL(`/?error=TokenFailed&details=${errorMsg}`, request.url));
  }

  const userResponse = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const userData = await userResponse.json();

  const username = userData.username === "gamernation12" ? "GamerNation12" : userData.username;

  let displayName = null;
  let sql;
  try {
    sql = postgres(process.env.DATABASE_URL || process.env.POSTGRES_URL || "");
    const userSettings = await sql`SELECT display_name FROM user_settings WHERE user_id = ${userData.id}`;
    if (userSettings.length > 0) {
      displayName = userSettings[0].display_name;
    }
  } catch (e) {
    console.error("Failed to fetch user settings:", e);
  }

  const resolvedName = displayName || username;

  const jwt = await signToken({
    id: userData.id,
    name: resolvedName,
    discord_name: username,
    email: userData.email,
    image: `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`,
  });

  const state = searchParams.get('state');
  const isMobile = state === 'mobile';
  const actionName = isMobile ? 'Mobile App Login' : 'Website Login';
  const actionDetails = isMobile ? 'User logged into the mobile app' : 'User logged into dashboard';

  // Log the login
  try {
    if (!sql) sql = postgres(process.env.DATABASE_URL || process.env.POSTGRES_URL || "");
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
    const appUrl = `djscratch://auth?token=${jwt}`;
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Login Successful</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { background-color: #09090b; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          a { background-color: #5865F2; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 18px; margin-top: 24px; box-shadow: 0 4px 15px rgba(88,101,242,0.4); }
          .spinner { width: 40px; height: 40px; border: 4px solid rgba(88,101,242,0.3); border-top-color: #5865F2; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px; }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.location.replace("${appUrl}");
            }, 500);
          }
        </script>
      </head>
      <body>
        <div class="spinner"></div>
        <h2>Login Successful!</h2>
        <p style="color: #a1a1aa; max-width: 80%;">You should be automatically redirected back to the app in a few seconds.</p>
        <a href="${appUrl}">Open App Manually</a>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  if (state === 'desktop') {
    // Redirect to the local server started by flutter_web_auth_2 on the user's PC
    return NextResponse.redirect(`http://localhost:43210/auth?token=${jwt}`);
  }

  return NextResponse.redirect(new URL(`/logging-in#token=${jwt}`, request.url));
}
