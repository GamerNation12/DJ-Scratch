import { NextResponse } from 'next/server';
import { Pool } from "pg";
import { verifyToken } from '@/lib/jwt';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const decoded = await verifyToken(token);
  
  if (!decoded || decoded.id !== "759433582107426816") {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  let totalPlays = 0;
  let totalUsers = 0;
  let botStats = null;
  let commandUsage = [];
  
  try {
    const playsResult = await pool.query("SELECT COUNT(*) FROM listens");
    totalPlays = parseInt(playsResult.rows[0].count, 10);
    
    const usersResult = await pool.query("SELECT COUNT(*) FROM imported_users");
    totalUsers = parseInt(usersResult.rows[0].count, 10);

    const botStatsResult = await pool.query("SELECT value FROM global_settings WHERE key = 'bot_stats'");
    if (botStatsResult.rows.length > 0) {
      botStats = JSON.parse(botStatsResult.rows[0].value);
    }

    const commandsResult = await pool.query("SELECT command_name, usage_count FROM command_usage ORDER BY usage_count DESC LIMIT 5");
    commandUsage = commandsResult.rows;

  } catch (e) {
    console.error("Failed to fetch stats:", e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    await pool.end();
  }
  
  return NextResponse.json({ totalPlays, totalUsers, botStats, commandUsage });
}
