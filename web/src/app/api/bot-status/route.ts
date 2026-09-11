import { NextResponse } from 'next/server';
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const rows = await sql`SELECT key, value FROM global_settings WHERE key IN ('bot_status', 'bot_track', 'bot_album')`;
    let status = null;
    let track = null;
    let album = null;

    rows.forEach(row => {
      if (row.key === 'bot_status') status = row.value;
      if (row.key === 'bot_track') track = row.value;
      if (row.key === 'bot_album') album = row.value;
    });

    return NextResponse.json({ status, track, album });
  } catch (error) {
    console.error("Failed to fetch bot status:", error);
    return NextResponse.json({ error: "Failed to fetch bot status" }, { status: 500 });
  }
}
