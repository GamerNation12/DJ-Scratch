import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { Pool } from "@neondatabase/serverless";
import AdminClient from "./AdminClient";

async function getStats() {
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
  } finally {
    await pool.end();
  }
  
  return { totalPlays, totalUsers, botStats, commandUsage };
}

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  
  if (!session || (session.user as any)?.id !== "759433582107426816") {
    redirect("/");
  }

  const data = await getStats();

  return <AdminClient data={data} />;
}
