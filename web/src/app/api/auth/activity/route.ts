import { NextResponse } from 'next/server';
import { signToken } from '@/lib/jwt';
import { sql } from "@/lib/db";

export const dynamic = 'force-dynamic';

/** Discord Activity (embedded app) login: exchanges an SDK authorize() code.
 *
 * Unlike the web flow there is no redirect URI in this grant — the code comes
 * from sdk.commands.authorize() inside the Activity iframe, where top-level
 * OAuth redirects are blocked by the Discord client. Mints the same JWT shape
 * as /api/auth/callback so the client session code is shared.
 */
export async function POST(request: Request) {
  let code: string | null = null;
  try {
    const body = await request.json();
    code = typeof body?.code === "string" ? body.code : null;
  } catch {
    code = null;
  }
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const clientId = process.env.DISCORD_CLIENT_ID!;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET!;

  let tokenData: { access_token?: string; error?: string; error_description?: string } | null = null;
  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
      }),
    });
    tokenData = await tokenResponse.json();
  } catch (e) {
    console.error("Activity token exchange failed:", e);
    return NextResponse.json({ error: "Exchange failed" }, { status: 502 });
  }

  if (!tokenData?.access_token) {
    return NextResponse.json(
      { error: tokenData?.error_description || tokenData?.error || "Unknown_Discord_Error" },
      { status: 401 }
    );
  }

  let userData: {
    id?: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
    email?: string;
  } | null = null;
  try {
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    userData = await userResponse.json();
  } catch (e) {
    console.error("Activity user fetch failed:", e);
    return NextResponse.json({ error: "User fetch failed" }, { status: 502 });
  }
  if (!userData?.id) {
    return NextResponse.json({ error: "Invalid user" }, { status: 401 });
  }
  const discordId: string = userData.id;
  const rawUsername: string = userData.username || "Unknown";
  const username = rawUsername === "gamernation12" ? "GamerNation12" : rawUsername;

  const defaultAvatarIndex = (() => {
    try {
      return Number((BigInt(discordId) >> BigInt(22)) % BigInt(6));
    } catch {
      return 0;
    }
  })();
  const avatarUrl = userData.avatar
    ? `https://cdn.discordapp.com/avatars/${discordId}/${userData.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;

  let displayName = null;
  try {
    const userSettings = await sql`SELECT display_name FROM user_settings WHERE user_id = ${discordId}`;
    if (userSettings.length > 0) {
      displayName = userSettings[0].display_name;
    }
  } catch (e) {
    console.error("Failed to fetch user settings:", e);
  }

  const resolvedName = displayName || username;

  const jwt = await signToken({
    id: discordId,
    name: resolvedName,
    discord_name: username,
    email: userData.email,
    image: avatarUrl,
  });

  try {
    await sql`CREATE TABLE IF NOT EXISTS website_logs (id SERIAL PRIMARY KEY, user_id TEXT, username TEXT, action TEXT, details TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    await sql`
      INSERT INTO website_logs (user_id, username, action, details)
      VALUES (${discordId}, ${username}, 'Activity Login', 'User logged in via Discord Activity')
    `;
    await sql`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS discord_username TEXT`;
    await sql`
      INSERT INTO user_settings (user_id, discord_username, display_name)
      VALUES (${discordId}, ${rawUsername}, ${userData.global_name || rawUsername})
      ON CONFLICT (user_id) DO UPDATE SET
        discord_username = EXCLUDED.discord_username,
        display_name = CASE WHEN COALESCE(user_settings.display_name_custom, FALSE)
          THEN user_settings.display_name ELSE EXCLUDED.display_name END
    `;
    await sql`ALTER TABLE imported_users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
    await sql`
      INSERT INTO imported_users (id, username, avatar_url)
      VALUES (${discordId}, ${username}, ${avatarUrl})
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, avatar_url = EXCLUDED.avatar_url
    `;
    await sql`
      DELETE FROM website_logs
      WHERE id NOT IN (
        SELECT id FROM website_logs ORDER BY timestamp DESC LIMIT 200
      )
    `;
  } catch (e) {
    console.error("Failed to log activity login:", e);
  }

  return NextResponse.json({ token: jwt });
}
