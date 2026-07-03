import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'direct_messages'
    `;
    
    // Also try a test query
    let error = null;
    try {
      await sql`SELECT id, sender_id, receiver_id, content, sent_at, read_at, reactions FROM direct_messages LIMIT 1`;
    } catch(e: any) {
      error = e.message;
    }

    return NextResponse.json({ columns, error });
  } catch(e: any) {
    return NextResponse.json({ error: e.message });
  }
}
