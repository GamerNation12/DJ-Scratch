import { NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";
import { signToken } from '@/lib/jwt';
import { refreshLoginMessage } from '@/lib/loginRefresh';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const discordId = searchParams.get("discord_id"); // Optional for web login

  if (!token) {
    // NOTE: no per-route CORS headers — middleware.ts echoes the caller
    // origin. A second Allow-Origin value would fail the browser check.
    return NextResponse.json(
      { success: false, error: "Missing token parameter." },
      { status: 400 }
    );
  }

  const apiKey = process.env.LASTFM_API_KEY || "eee299142ac5fe73e5eb5dcd1c29bcae";
  const sharedSecret = process.env.LASTFM_SHARED_SECRET || "e566dd2098e65ed746edc1a4a5ef62f0";

  if (!sharedSecret) {
    return NextResponse.json(
      { success: false, error: "Configuration error: LASTFM_SHARED_SECRET is not set in the environment. Please contact the bot owner." },
      { status: 500 }
    );
  }

  try {
    // Generate api_sig
    // Last.fm requires alphabetical sorting of parameters
    // Params: api_key, method, token
    const sigString = `api_key${apiKey}methodauth.getSessiontoken${token}${sharedSecret}`;
    const apiSig = crypto.createHash("md5").update(sigString, "utf8").digest("hex");

    const url = `http://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${apiKey}&token=${token}&api_sig=${apiSig}&format=json`;
    
    const res = await fetch(url);
    const data = await res.json();

    if (data.error || !data.session?.name) {
      console.error("Last.fm Auth Error:", data);
      return NextResponse.json(
        { success: false, error: `Last.fm Authentication Failed: ${data.message || "Unknown error"}` },
        { status: 400 }
      );
    }

    const lastfmUsername = data.session.name;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // Web Login Flow
    if (!discordId) {
      const { rows } = await pool.query(`SELECT user_id, discord_username FROM user_settings WHERE lastfm_username ILIKE $1`, [lastfmUsername]);
      
      if (rows.length === 0) {
        await pool.end();
        return NextResponse.redirect(new URL('/?error=NoAccountLinked', req.url));
      }

      const userId = rows[0].user_id;
      let username = rows[0].discord_username || lastfmUsername;
      let avatarUrl = "";

      // Try to fetch discord info using bot token
      if (process.env.DISCORD_TOKEN) {
        try {
          const dRes = await fetch(`https://discord.com/api/v10/users/${userId}`, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
          });
          if (dRes.ok) {
            const dData = await dRes.json();
            username = dData.global_name || dData.username;
            if (dData.avatar) {
              avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${dData.avatar}.png`;
            }
          }
        } catch (e) {
          console.error("Failed to fetch discord user during last.fm login:", e);
        }
      }

      const jwt = await signToken({
        id: userId,
        name: username,
        image: avatarUrl,
      });

      await pool.query(`CREATE TABLE IF NOT EXISTS website_logs (id SERIAL PRIMARY KEY, user_id TEXT, username TEXT, action TEXT, details TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
      await pool.query(
        `INSERT INTO website_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)`,
        [userId, username, 'Website Login', 'User logged in via Last.fm']
      );
      await pool.end();

      return NextResponse.redirect(new URL(`/logging-in#token=${jwt}`, req.url));
    }

    // Account Linking Flow
    await pool.query(
      `INSERT INTO user_settings (user_id, lastfm_username) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id) DO UPDATE SET lastfm_username = EXCLUDED.lastfm_username`,
      [discordId, lastfmUsername]
    );

    // Log the action
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS website_logs (id SERIAL PRIMARY KEY, user_id TEXT, username TEXT, action TEXT, details TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
      await pool.query(
        `INSERT INTO website_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)`,
        [discordId, discordId, 'Account Linked', `Linked Last.fm account: ${lastfmUsername}`]
      );
      await pool.query(
        `DELETE FROM website_logs WHERE id NOT IN (SELECT id FROM website_logs ORDER BY timestamp DESC LIMIT 200)`
      );
    } catch (e) {
      console.error("Failed to log website action:", e);
    }

    // Prefix flow: refresh the original `,login` message (slash flow is
    // handled via the interaction webhook below).
    if (!searchParams.get("interaction_token") && discordId) {
      try {
        const origin = new URL(req.url).origin;
        await refreshLoginMessage({
          channelId: searchParams.get("channel_id"),
          messageId: searchParams.get("message_id"),
          userId: discordId,
          siteOrigin: origin,
          linkedLastfmUsername: lastfmUsername,
        });
      } catch (e) {
        console.error("Failed to refresh login message:", e);
      }
    }

    await pool.end();

    const interactionToken = searchParams.get("interaction_token");
    const appId = searchParams.get("app_id");

    if (interactionToken && appId) {
      try {
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            embeds: [{
              title: "✅ Account Linked!",
              description: `Successfully linked your Discord to Last.fm account: **${lastfmUsername}**`,
              color: 0x4caf50
            }],
            components: []
          })
        });
      } catch (e) {
        console.error("Failed to update discord message:", e);
      }
    }

    // Return JSON response (CORS comes from middleware.ts)
    return NextResponse.json(
      { success: true, username: lastfmUsername },
      { status: 200 }
    );
  } catch (error) {
    console.error("Callback Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error while linking account." },
      { status: 500 }
    );
  }
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
