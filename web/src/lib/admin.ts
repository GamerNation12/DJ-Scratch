import { sql } from "./db";
import { verifyToken } from "./jwt";

export type AdminRole = "owner" | "admin" | "moderator" | null;
export type AdminIdentity = { userId: string; role: Exclude<AdminRole, null> };

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

/**
 * Authenticate an admin/owner request from its Bearer token.
 * Pass the roles that are allowed to perform the action.
 */
export async function getAdminFromRequest(
  req: Request,
  allowed: readonly Exclude<AdminRole, null>[] = ["owner", "admin", "moderator"]
): Promise<AdminIdentity | null> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const user = await verifyToken(token).catch(() => null);
  const userId = user ? String((user as { id?: unknown }).id || "") : "";
  if (!userId) return null;

  const role = await getAdminRole(userId).catch(() => null);
  if (!role || !allowed.includes(role)) return null;

  return { userId, role };
}
