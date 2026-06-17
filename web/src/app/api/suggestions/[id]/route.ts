import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";

const ADMIN_ID = "759433582107426816";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.id !== ADMIN_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const { status, admin_feedback } = await req.json();
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query(
      "UPDATE suggestions SET status = $1, admin_feedback = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *",
      [status, admin_feedback, id]
    );
    await pool.end();

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("Failed to update suggestion:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
