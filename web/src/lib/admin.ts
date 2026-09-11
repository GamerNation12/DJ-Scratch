import { sql } from "./db";

export type AdminRole = "owner" | "admin" | "moderator" | null;

export async function getAdminRole(userId: string): Promise<AdminRole> {
  if (userId === "759433582107426816") return "owner";

  try {
    const rows = await sql`SELECT value FROM global_settings WHERE key = 'admin_users'`;
    if (rows.length > 0) {
      const adminUsers = JSON.parse(rows[0].value);
      if (adminUsers.admins && adminUsers.admins.includes(userId)) return "admin";
      if (adminUsers.moderators && adminUsers.moderators.includes(userId)) return "moderator";
    }
  } catch (e) {
    console.error("Error fetching admin users:", e);
  }

  return null;
}
