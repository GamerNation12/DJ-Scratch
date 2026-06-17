import { NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";

export const revalidate = 60;

export async function GET() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const usersResult = await pool.query("SELECT COUNT(*) FROM imported_users");
    const totalUsers = parseInt(usersResult.rows[0].count, 10);

    const botStatsResult = await pool.query("SELECT value FROM global_settings WHERE key = 'bot_stats'");
    let activeMembers = 0;
    if (botStatsResult.rows.length > 0) {
      const stats = JSON.parse(botStatsResult.rows[0].value);
      activeMembers = stats.member_count || 0;
    }
    
    return NextResponse.json({ totalUsers, activeMembers });
  } catch (err) {
    console.error("Public stats error:", err);
    return NextResponse.json({ totalUsers: 0, activeMembers: 0 }, { status: 500 });
  } finally {
    await pool.end();
  }
}
