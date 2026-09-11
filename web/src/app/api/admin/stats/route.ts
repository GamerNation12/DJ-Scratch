import { getAdminRole } from "@/lib/admin";
import { NextResponse } from 'next/server';
import { sql } from "@/lib/db";
import { verifyToken } from '@/lib/jwt';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const decoded: any = await verifyToken(token);
  
  const role = decoded ? await getAdminRole(decoded.id) : null;
  if (!role || (role !== "owner" && role !== "admin")) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let totalPlays = 0;
  let totalUsers = 0;
  let botStats = null;
  let statusActivity = null;
  let commandUsage: any[] = [];
  let currentVersion = "v1.0.0";

  try {
    const [playsResult] = await sql`SELECT COUNT(*) FROM listens`;
    totalPlays = parseInt(playsResult.count, 10);

    const [usersResult] = await sql`SELECT COUNT(*) FROM imported_users`;
    totalUsers = parseInt(usersResult.count, 10);

    const botStatsResult = await sql`SELECT value FROM global_settings WHERE key = 'bot_stats'`;
    if (botStatsResult.length > 0) {
      botStats = JSON.parse(botStatsResult[0].value);
    }

    const botStatusResult = await sql`SELECT value FROM global_settings WHERE key = 'bot_status'`;
    if (botStatusResult.length > 0) {
      statusActivity = botStatusResult[0].value;
    }

    const versionResult = await sql`SELECT value FROM global_settings WHERE key = 'current_update_version'`;
    if (versionResult.length > 0) {
      currentVersion = versionResult[0].value;
    }

    commandUsage = await sql`SELECT command_name, usage_count FROM command_usage ORDER BY usage_count DESC LIMIT 5`;

  } catch (e) {
    console.error("Failed to fetch stats:", e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
  
  return NextResponse.json({ totalPlays, totalUsers, botStats, commandUsage, statusActivity, currentVersion });
}
