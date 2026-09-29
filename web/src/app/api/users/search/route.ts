import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Public user directory for adding friends: matches by username prefix,
// hides yourself, private profiles, and anyone you're already connected to.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;
  if (!user || !(user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (user as any).id;
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ users: [] });

  try {
    const rows = await sql`
      SELECT iu.id, iu.username, iu.avatar_url, us.display_name
      FROM imported_users iu
      LEFT JOIN user_settings us ON us.user_id = iu.id
      LEFT JOIN friends e ON (
        (e.user_id = ${userId} AND e.friend_id = iu.id)
        OR (e.user_id = iu.id AND e.friend_id = ${userId})
      )
      WHERE iu.username ILIKE ${"%" + q + "%"}
        AND iu.id != ${userId}
        AND (us.private_mode IS NOT TRUE)
        AND e.user_id IS NULL
      ORDER BY iu.username ASC
      LIMIT 10
    `;
    return NextResponse.json({
      users: rows.map((r: any) => ({
        userId: r.id,
        username: r.username,
        displayName: r.display_name || null,
        avatar: r.avatar_url || null,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
