import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export async function GET(req: Request) {
  try {
    if (!DB_URL) {
      console.error("No database URL provided");
      return NextResponse.redirect(new URL('/vercel.svg', 'https://the-goats-dj.vercel.app'));
    }
    const sql = neon(DB_URL);
    const rows = await sql`SELECT value FROM global_settings WHERE key = 'current_avatar'`;
    if (rows.length > 0 && rows[0].value) {
      // Fetch the image buffer and return it directly, because some browsers refuse to follow redirects for favicons
      const imgRes = await fetch(rows[0].value);
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': imgRes.headers.get('Content-Type') || 'image/png',
            'Cache-Control': 'public, max-age=60',
          },
        });
      }
    }
  } catch (err) {
    console.error("Failed to fetch bot avatar:", err);
  }
  
  // Fallback to Vercel default icon if nothing in DB
  const fallbackRes = await fetch(new URL('/vercel.svg', 'https://the-goats-dj.vercel.app'));
  const fallbackBuffer = await fallbackRes.arrayBuffer();
  return new NextResponse(fallbackBuffer, {
    headers: { 'Content-Type': 'image/svg+xml' }
  }); 
}
