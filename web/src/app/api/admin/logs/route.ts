import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { verifyToken } from "@/lib/jwt";

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    const user = token ? await verifyToken(token) : null;
    
    // Only allow specific admin
    if (!user || user.id !== "759433582107426816") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = neon(DB_URL!);
    
    // Ensure table exists before querying
    await sql`CREATE TABLE IF NOT EXISTS website_logs (id SERIAL PRIMARY KEY, user_id TEXT, username TEXT, action TEXT, details TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    
    const logs = await sql`
      SELECT id, user_id, username, action, details, timestamp 
      FROM website_logs 
      ORDER BY timestamp DESC 
      LIMIT 100
    `;

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
