import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export const revalidate = 60;

export async function GET(req: Request) {
  try {
    const [usersResult] = await sql`SELECT COUNT(*) FROM user_settings WHERE lastfm_username IS NOT NULL`;
    const totalUsers = parseInt(usersResult.count, 10);

    const botStatsResult = await sql`SELECT value FROM global_settings WHERE key = 'bot_stats'`;
    let activeMembers = 0;
    let serverCount = 0;
    if (botStatsResult.length > 0) {
      const stats = JSON.parse(botStatsResult[0].value);
      activeMembers = stats.member_count || 0;
      serverCount = stats.server_count || 0;
    }

    const topUsersResult = await sql`
      SELECT user_id, COUNT(*) as count
      FROM listens
      GROUP BY user_id
      ORDER BY count DESC
      LIMIT 3
    `;

    const botToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
    const topAvatars = await Promise.all(topUsersResult.map(async (row) => {
      try {
        const res = await fetch(`https://discord.com/api/v10/users/${row.user_id}`, {
          headers: { Authorization: `Bot ${botToken}` },
          next: { revalidate: 3600 } 
        });
        if (res.ok) {
          const data = await res.json();
          if (data.avatar) {
            return `https://cdn.discordapp.com/avatars/${row.user_id}/${data.avatar}.png?size=128`;
          }
        }
      } catch (e) {
        console.error("Failed to fetch avatar for", row.user_id, e);
      }
      return null;
    }));

    // Filter out nulls and fill remaining slots if < 3
    const validAvatars = topAvatars.filter(Boolean);
    
    return NextResponse.json({ totalUsers, activeMembers, serverCount, topAvatars: validAvatars });
  } catch (err) {
    console.error("Public stats error:", err);
    return NextResponse.json({ totalUsers: 0, activeMembers: 0, serverCount: 0, topAvatars: [] }, { status: 500 });
  }
}
