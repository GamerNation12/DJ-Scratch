import { NextResponse } from 'next/server';
import { Pool } from "pg";

export async function GET() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query("SELECT value FROM global_settings WHERE key = 'bot_status'");
    let status = null;
    if (result.rows.length > 0) {
      status = result.rows[0].value;
    }
    return NextResponse.json({ status });
  } catch (error) {
    console.error("Failed to fetch bot status:", error);
    return NextResponse.json({ error: "Failed to fetch bot status" }, { status: 500 });
  } finally {
    await pool.end();
  }
}
