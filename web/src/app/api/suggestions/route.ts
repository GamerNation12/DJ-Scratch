import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";

const ADMIN_ID = "759433582107426816";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any)?.id;
  const isAdmin = userId === ADMIN_ID;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    let result;
    if (isAdmin) {
      result = await pool.query("SELECT * FROM suggestions ORDER BY created_at DESC");
    } else {
      result = await pool.query("SELECT * FROM suggestions WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
    }
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch suggestions:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    await pool.end();
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any)?.id;
  const username = session.user?.name || "Unknown";
  
  try {
    const { title, description } = await req.json();
    
    if (!title || !description) {
      return NextResponse.json({ error: "Title and description required" }, { status: 400 });
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query(
      "INSERT INTO suggestions (user_id, username, title, description) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, username, title, description]
    );
    await pool.end();
    
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("Failed to submit suggestion:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
