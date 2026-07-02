import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { sendDiscordDM } from "@/lib/discord";

async function getUser(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  return token ? await verifyToken(token) : null;
}

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user || !(user as any).id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (user as any).id;

  try {
    const friends = await sql`
      SELECT f.friend_id, f.status, u.username as friend_username, s.display_name, 'outgoing' as direction
      FROM friends f
      JOIN imported_users u ON f.friend_id = u.id
      LEFT JOIN user_settings s ON u.id = s.user_id
      WHERE f.user_id = ${userId}
      UNION
      SELECT f.user_id as friend_id, f.status, u.username as friend_username, s.display_name, 'incoming' as direction
      FROM friends f
      JOIN imported_users u ON f.user_id = u.id
      LEFT JOIN user_settings s ON u.id = s.user_id
      WHERE f.friend_id = ${userId} AND f.status = 'pending'
    `;
    
    return NextResponse.json({ friends });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || !(user as any).id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (user as any).id;

  const { action, targetId, targetUsername } = await req.json();

  if ((!targetId && !targetUsername) || !action) {
    return NextResponse.json({ error: "Missing action or target" }, { status: 400 });
  }

  try {
    let finalTargetId = targetId;
    if (targetUsername) {
      const uRow = await sql`SELECT id FROM imported_users WHERE LOWER(username) = LOWER(${targetUsername})`;
      if (uRow.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });
      finalTargetId = uRow[0].id;
    }
    if (action === "request") {
      const targetUser = await sql`SELECT id FROM imported_users WHERE id = ${finalTargetId}`;
      if (targetUser.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });

      if (finalTargetId === userId) return NextResponse.json({ error: "Cannot add yourself" }, { status: 400 });

      const existing = await sql`SELECT status FROM friends WHERE user_id = ${finalTargetId} AND friend_id = ${userId}`;
      if (existing.length > 0 && existing[0].status === 'pending') {
        await sql`UPDATE friends SET status='accepted' WHERE user_id=${finalTargetId} AND friend_id=${userId}`;
        await sql`INSERT INTO friends (user_id, friend_id, status) VALUES (${userId}, ${finalTargetId}, 'accepted') ON CONFLICT (user_id, friend_id) DO UPDATE SET status='accepted'`;
        await sendDiscordDM(finalTargetId, `**${(user as any).name}** accepted your friend request on DJ Scratch!`);
        return NextResponse.json({ success: true, status: 'accepted' });
      }

      await sql`INSERT INTO friends (user_id, friend_id, status) VALUES (${userId}, ${finalTargetId}, 'pending') ON CONFLICT (user_id, friend_id) DO NOTHING`;
      await sendDiscordDM(finalTargetId, `**${(user as any).name}** sent you a friend request on DJ Scratch! Visit the app to accept it.`);
      return NextResponse.json({ success: true, status: 'pending' });
    } 
    else if (action === "accept") {
      await sql`UPDATE friends SET status='accepted' WHERE user_id=${finalTargetId} AND friend_id=${userId}`;
      await sql`INSERT INTO friends (user_id, friend_id, status) VALUES (${userId}, ${finalTargetId}, 'accepted') ON CONFLICT (user_id, friend_id) DO UPDATE SET status='accepted'`;
      await sendDiscordDM(finalTargetId, `**${(user as any).name}** accepted your friend request on DJ Scratch!`);
      return NextResponse.json({ success: true, status: 'accepted' });
    }
    else if (action === "remove" || action === "reject") {
      await sql`DELETE FROM friends WHERE (user_id=${userId} AND friend_id=${finalTargetId}) OR (user_id=${finalTargetId} AND friend_id=${userId})`;
      return NextResponse.json({ success: true, status: 'removed' });
    }
    
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
