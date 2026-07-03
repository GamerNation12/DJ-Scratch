import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    let rows = [];
    try {
      rows = await sql`SELECT id, sender_id, receiver_id, content, sent_at, read_at, reactions FROM direct_messages ORDER BY sent_at DESC LIMIT 5`;
    } catch(e: any) {
      return NextResponse.json({ error: e.message });
    }

    return NextResponse.json({ rows });
  } catch(e: any) {
    return NextResponse.json({ error: e.message });
  }
}
