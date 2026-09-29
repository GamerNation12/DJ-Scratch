import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    // 1. Top Artists (across the whole platform)
    const topArtists = await sql`
      SELECT t.artist_name, COUNT(*) as playcount
      FROM listens l JOIN tracks t ON l.track_id = t.id
      GROUP BY t.artist_name
      ORDER BY playcount DESC
      LIMIT 10
    `;

    // 2. Most Active Chatters (DM feature retired — kept empty for compat).
    const topChatters: unknown[] = [];

    return NextResponse.json({
      topArtists,
      topChatters
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
