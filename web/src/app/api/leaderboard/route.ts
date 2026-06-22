import { NextResponse } from "next/server";
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "696438a21fc540d4cb27faa736239e75";
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;

export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  try {
    const sql = postgres(DB_URL!);
    
    // Fetch all public users who have linked a Last.fm account
    const rows = await sql`
      SELECT user_id, lastfm_username, discord_username 
      FROM user_settings 
      WHERE private_mode = FALSE 
      AND lastfm_username IS NOT NULL
      AND discord_username IS NOT NULL
    `;

    if (rows.length === 0) {
      return NextResponse.json({ success: true, leaderboard: [] });
    }

    const leaderboard: any[] = [];

    // Fetch Last.fm and Discord Data concurrently
    await Promise.all(rows.map(async (r) => {
      let playcount = 0;
      let discordName = r.discord_username;
      let discordAvatar = null;

      try {
        const [lastfmRes, discordRes] = await Promise.all([
          fetch(`http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${r.lastfm_username}&api_key=${LASTFM_API_KEY}&format=json`),
          fetch(`https://discord.com/api/v10/users/${r.user_id}`, {
            headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
            next: { revalidate: 3600 } 
          })
        ]);

        if (lastfmRes.ok) {
          const lData = await lastfmRes.json();
          if (!lData.error && lData.user) {
            playcount = parseInt(lData.user.playcount || "0", 10);
          }
        }

        if (discordRes.ok) {
          const dData = await discordRes.json();
          discordName = dData.global_name || dData.username || r.discord_username;
          if (dData.avatar) {
            discordAvatar = `https://cdn.discordapp.com/avatars/${r.user_id}/${dData.avatar}.png?size=256`;
          }
        }
      } catch (e) {
        console.error(`Failed to fetch data for user ${r.user_id}:`, e);
      }

      leaderboard.push({
        userId: r.user_id,
        username: discordName,
        avatar: discordAvatar,
        lastfm_username: r.lastfm_username,
        playcount: playcount
      });
    }));

    // Sort by playcount descending
    leaderboard.sort((a, b) => b.playcount - a.playcount);

    return NextResponse.json({
      success: true,
      leaderboard: leaderboard
    });

  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
