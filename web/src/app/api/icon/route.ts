import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export async function GET() {
  try {
    if (!DB_URL) {
      console.error("No database URL provided");
      return NextResponse.redirect(new URL('/vercel.svg', 'https://the-goats-dj.vercel.app'));
    }
    const sql = neon(DB_URL);
    const rows = await sql`SELECT value FROM global_settings WHERE key = 'current_avatar'`;
    if (rows.length > 0 && rows[0].value) {
      // Redirect to the external image URL
      return NextResponse.redirect(rows[0].value);
    }
  } catch (err) {
    console.error("Failed to fetch bot avatar:", err);
  }
  
  // Fallback to Vercel default icon if nothing in DB
  return NextResponse.redirect(new URL('/vercel.svg', 'https://the-goats-dj.vercel.app')); 
}
