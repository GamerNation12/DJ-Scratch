import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { getAdminRole } from '@/lib/admin';
import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const decoded: any = await verifyToken(token);
  
  if (!decoded || !decoded.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getAdminRole(decoded.id);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const sql = postgres(DB_URL!);
    
    // Fetch all users with relevant fields
    const users = await sql`
      SELECT user_id, discord_username, lastfm_username, display_name, is_banned, ban_reason, ban_expires_at, private_mode
      FROM user_settings
      ORDER BY discord_username ASC NULLS LAST
    `;
    
    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Admin fetch users error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
