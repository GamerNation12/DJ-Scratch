import { NextResponse } from 'next/server';
import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL || "", { ssl: 'require' });

export async function GET(req: Request) {
  try {
    // Explicitly do NOT select the 'content' column to guarantee privacy.
    const logs = await sql`
      SELECT 
        dm.id, 
        dm.sender_id, 
        u1.username as sender_username,
        dm.receiver_id,
        u2.username as receiver_username,
        dm.sent_at as created_at
      FROM direct_messages dm
      LEFT JOIN imported_users u1 ON dm.sender_id = u1.id
      LEFT JOIN imported_users u2 ON dm.receiver_id = u2.id
      ORDER BY dm.sent_at DESC
      LIMIT 100
    `;

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("Failed to fetch chat logs:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
