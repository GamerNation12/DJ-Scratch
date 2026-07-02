import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    // 1. Top Artists (across the whole platform)
    const topArtists = await sql`
      SELECT artist_name, COUNT(*) as playcount
      FROM listens
      GROUP BY artist_name
      ORDER BY playcount DESC
      LIMIT 10
    `;

    // 2. Most Active Chatters
    const topChatters = await sql`
      SELECT u.username, u.id as user_id, COUNT(d.id) as message_count
      FROM imported_users u
      JOIN direct_messages d ON d.sender_id = u.id
      GROUP BY u.id, u.username
      ORDER BY message_count DESC
      LIMIT 10
    `;

    return NextResponse.json({
      topArtists,
      topChatters
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
