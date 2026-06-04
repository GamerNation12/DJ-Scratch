import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { Pool } from "@neondatabase/serverless";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any)?.id !== "759433582107426816") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { actionType, payload } = body;

    if (!actionType || !["SYNC_COMMANDS", "RESTART_BOT", "CLEAR_DUPLICATES", "SEND_MESSAGE"].includes(actionType)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    await pool.query(
      "INSERT INTO bot_actions (action_type, payload, status) VALUES ($1, $2, 'PENDING')",
      [actionType, payload ? JSON.stringify(payload) : null]
    );

    await pool.end();

    return NextResponse.json({ success: true, message: `Action ${actionType} queued successfully.` });
  } catch (error) {
    console.error("Failed to insert bot action:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
