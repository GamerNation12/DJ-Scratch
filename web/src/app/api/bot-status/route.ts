import { NextResponse } from 'next/server';
import { sql, withDbTimeout } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 15; // Bot status changes rarely; cache to keep DB load low.
export const maxDuration = 10; // Fail fast instead of hanging to Vercel's 300s kill.

export async function GET() {
  try {
    const rows = await withDbTimeout(sql`SELECT key, value FROM global_settings WHERE key IN ('bot_status', 'bot_track', 'bot_album')`);
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
    return NextResponse.json({ error: "Failed to fetch bot status" }, { status: 503 });
  }
}
