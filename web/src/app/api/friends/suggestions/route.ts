import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// People you may know: friends-of-friends ranked by mutual count, topped up
// with recently active public listeners. Never includes yourself, private
// profiles, or anyone you're already connected to.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;
  if (!user || !(user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (user as any).id;

  try {
    const fof = await sql`
      WITH mine AS (
        SELECT CASE WHEN user_id = ${userId} THEN friend_id ELSE user_id END AS fid
        FROM friends
        WHERE (user_id = ${userId} OR friend_id = ${userId}) AND status = 'accepted'
      ),
      fof AS (
        SELECT
          CASE WHEN f.user_id = m.fid THEN f.friend_id ELSE f.user_id END AS cand,
          COUNT(*) AS mutuals
        FROM friends f
        JOIN mine m ON (f.user_id = m.fid OR f.friend_id = m.fid)
        WHERE f.status = 'accepted'
        GROUP BY cand
      )
      SELECT iu.id, iu.username, iu.avatar_url, us.display_name, fof.mutuals
      FROM fof
      JOIN imported_users iu ON iu.id = fof.cand
      LEFT JOIN user_settings us ON us.user_id = iu.id
      LEFT JOIN friends e ON (
        (e.user_id = ${userId} AND e.friend_id = fof.cand)
        OR (e.user_id = fof.cand AND e.friend_id = ${userId})
      )
      WHERE fof.cand != ${userId}
        AND (us.private_mode IS NOT TRUE)
        AND e.user_id IS NULL
      ORDER BY fof.mutuals DESC
      LIMIT 8
    `;
    const out: any[] = fof.map((r: any) => ({
      userId: r.id,
      username: r.username,
      displayName: r.display_name || null,
      avatar: r.avatar_url || null,
      reason: `${parseInt(r.mutuals, 10)} mutual friend${parseInt(r.mutuals, 10) === 1 ? "" : "s"}`,
    }));

    // Top up with recently active public listeners when FoF runs thin.
    if (out.length < 8) {
      const seen = new Set(out.map((u) => u.userId));
      const active = await sql`
        SELECT iu.id, iu.username, iu.avatar_url, us.display_name
        FROM imported_users iu
        JOIN user_settings us ON us.user_id = iu.id
        LEFT JOIN friends e ON (
          (e.user_id = ${userId} AND e.friend_id = iu.id)
          OR (e.user_id = iu.id AND e.friend_id = ${userId})
        )
        WHERE iu.id != ${userId}
          AND (us.private_mode IS NOT TRUE)
          AND (us.last_active IS NOT NULL)
          AND e.user_id IS NULL
        ORDER BY us.last_active DESC
        LIMIT ${8 - out.length + 10}
      `;
      for (const r of active as any[]) {
        if (out.length >= 8 || seen.has(r.id)) continue;
        seen.add(r.id);
        out.push({
          userId: r.id,
          username: r.username,
          displayName: r.display_name || null,
          avatar: r.avatar_url || null,
          reason: "Active listener",
        });
      }
    }
    return NextResponse.json({ suggestions: out });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
