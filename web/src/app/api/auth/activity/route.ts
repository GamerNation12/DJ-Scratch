import { NextResponse } from 'next/server';
import { signToken } from '@/lib/jwt';
import postgres from 'postgres';

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'No code provided' }, { status: 400 });
    }

    const clientId = process.env.DISCORD_CLIENT_ID!;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET!;

    // Exchange the code for an access token
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

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return NextResponse.json({ error: 'Failed to obtain access token', details: tokenData }, { status: 400 });
    }

    // Get user info
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

    // Sign the JWT
    const jwt = await signToken({
      id: userData.id,
      name: resolvedName,
      discord_name: username,
      email: userData.email,
      image: `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`,
    });
    
    // Log Activity usage (optional)
    /*
    try {
      if (!sql) sql = postgres(process.env.DATABASE_URL || process.env.POSTGRES_URL || "");
      await sql`CREATE TABLE IF NOT EXISTS website_logs (id SERIAL PRIMARY KEY, user_id TEXT, username TEXT, action TEXT, details TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
      await sql`
        INSERT INTO website_logs (user_id, username, action, details)
        VALUES (${userData.id}, ${username}, 'Activity Login', 'User opened the Discord Activity for DMs')
      `;
    } catch (e) {
      // ignore
    }
    */

    return NextResponse.json({ token: jwt });
  } catch (error) {
    console.error("Error in activity auth route:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
