import { NextResponse } from 'next/server';
import { Pool } from "pg";

export async function GET() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query("SELECT key, value FROM global_settings WHERE key IN ('bot_status', 'bot_track', 'bot_album')");
    let status = null;
    let track = null;
    let album = null;
    
    result.rows.forEach(row => {
      if (row.key === 'bot_status') status = row.value;
      if (row.key === 'bot_track') track = row.value;
      if (row.key === 'bot_album') album = row.value;
    });
    
    return NextResponse.json({ status, track, album });
  } catch (error) {
    console.error("Failed to fetch bot status:", error);
    return NextResponse.json({ error: "Failed to fetch bot status" }, { status: 500 });
  } finally {
    await pool.end();
  }
}
