import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { getAdminRole } from '@/lib/admin';
import postgres from 'postgres';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export async function POST(req: Request) {
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
    const { userId, actionType, payload } = await req.json();
    if (!userId || !actionType) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const sql = postgres(DB_URL!);

    if (actionType === 'BAN') {
      const reason = payload?.reason || "No reason provided.";
      const durationHours = payload?.durationHours; // If null, permanent
      let expiresAt = null;

      if (durationHours) {
        expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
      }

      await sql`
        UPDATE user_settings 
        SET is_banned = TRUE, ban_reason = ${reason}, ban_expires_at = ${expiresAt}
        WHERE user_id = ${userId}
      `;
      return NextResponse.json({ success: true, message: "User banned." });
    } 
    
    else if (actionType === 'UNBAN') {
      await sql`
        UPDATE user_settings 
        SET is_banned = FALSE, ban_reason = NULL, ban_expires_at = NULL
        WHERE user_id = ${userId}
      `;
      return NextResponse.json({ success: true, message: "User unbanned." });
    }

    else if (actionType === 'EDIT_NAME') {
      const newName = payload?.displayName || null;
      await sql`
        UPDATE user_settings 
        SET display_name = ${newName}
        WHERE user_id = ${userId}
      `;
      return NextResponse.json({ success: true, message: "Display name updated." });
    }

    else if (actionType === 'RESET') {
      // Clear their last.fm link, display name, and set to private
      await sql`
        UPDATE user_settings 
        SET display_name = NULL, lastfm_username = NULL, private_mode = TRUE
        WHERE user_id = ${userId}
      `;
      return NextResponse.json({ success: true, message: "User profile reset." });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("Admin user action error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
