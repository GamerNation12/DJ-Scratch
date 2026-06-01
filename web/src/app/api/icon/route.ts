import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { rows } = await sql`SELECT value FROM global_settings WHERE key = 'current_avatar'`;
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
