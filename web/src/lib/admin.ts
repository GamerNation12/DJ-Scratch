import { Pool } from "pg";

export type AdminRole = "owner" | "admin" | "moderator" | null;

export async function getAdminRole(userId: string): Promise<AdminRole> {
  if (userId === "759433582107426816") return "owner";
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query("SELECT value FROM global_settings WHERE key = 'admin_users'");
    if (res.rows.length > 0) {
      const adminUsers = JSON.parse(res.rows[0].value);
      if (adminUsers.admins && adminUsers.admins.includes(userId)) return "admin";
      if (adminUsers.moderators && adminUsers.moderators.includes(userId)) return "moderator";
    }
  } catch (e) {
    console.error("Error fetching admin users:", e);
  } finally {
    await pool.end();
  }
  
  return null;
}
