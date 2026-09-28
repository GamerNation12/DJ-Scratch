import { NextResponse } from 'next/server';
import { signToken } from '@/lib/jwt';
import { sql } from "@/lib/db";

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

  // Accounts without a custom avatar have avatar=null (".../null.png" would 404),
  // so fall back to Discord's default avatar for the account.
  const defaultAvatarIndex = (() => {
    try {
      return Number((BigInt(userData.id) >> BigInt(22)) % BigInt(6));
    } catch {
      return 0;
    }
  })();
  const avatarUrl = userData.avatar
    ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;

  let displayName = null;
  try {
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
    image: avatarUrl,
  });

  const state = searchParams.get('state');
  const isMobile = state === 'mobile';
  const isDesktop = state === 'desktop';
  
  let actionName = 'Website Login';
  let actionDetails = 'User logged into dashboard';
  
  if (isMobile) {
    actionName = 'Mobile App Login';
    actionDetails = 'User logged into the mobile app';
  } else if (isDesktop) {
    actionName = 'Desktop App Login';
    actionDetails = 'User logged into the desktop app';
  }

  // Log the login
  try {
    await sql`CREATE TABLE IF NOT EXISTS website_logs (id SERIAL PRIMARY KEY, user_id TEXT, username TEXT, action TEXT, details TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    await sql`
      INSERT INTO website_logs (user_id, username, action, details)
      VALUES (${userData.id}, ${username}, ${actionName}, ${actionDetails})
    `;

    // Also link their discord username to their settings if it doesn't exist yet
    await sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS discord_username TEXT`;
    await sql`
      INSERT INTO user_settings (user_id, discord_username, display_name) 
      VALUES (${userData.id}, ${userData.username}, ${userData.global_name || userData.username})
      ON CONFLICT (user_id) DO UPDATE SET 
        discord_username = EXCLUDED.discord_username,
        display_name = CASE WHEN COALESCE(user_settings.display_name_custom, FALSE)
          THEN user_settings.display_name ELSE EXCLUDED.display_name END
    `;
    
    await sql`ALTER TABLE imported_users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
    await sql`
      INSERT INTO imported_users (id, username, avatar_url)
      VALUES (${userData.id}, ${username}, ${avatarUrl})
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, avatar_url = EXCLUDED.avatar_url
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
    // Server-side 302 straight to the custom scheme: flutter_web_auth_2
    // intercepts this navigation and returns to the app. (The old
    // HTML + JS-redirect page stranded users in the browser tab because
    // Custom Tabs don't auto-dispatch custom-scheme JS navigations.)
    return NextResponse.redirect(`djscratch://auth?token=${jwt}`);
  }
  
  if (state === 'desktop') {
    // Redirect to the local server started by flutter_web_auth_2 on the user's PC
    return NextResponse.redirect(`http://localhost:43210/auth?token=${jwt}`);
  }

  return NextResponse.redirect(new URL(`/logging-in#token=${jwt}`, request.url));
}
