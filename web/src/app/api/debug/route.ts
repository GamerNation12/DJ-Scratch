import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export async function GET() {
  const session = await getServerSession(authOptions);

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "NOT_SET";
  const safeUrl = dbUrl !== "NOT_SET" ? dbUrl.split("@")[1] : "NOT_SET"; // hide credentials

  try {
    const sql = neon(dbUrl);
    await sql`SELECT 1`;
    return NextResponse.json({
      db: "connected",
      host: safeUrl,
      session: session ? { name: session.user?.name, id: (session.user as any)?.id } : null,
    });
  } catch (err) {
    return NextResponse.json({
      db: "failed",
      error: String(err),
      host: safeUrl,
      session: session ? { name: session.user?.name, id: (session.user as any)?.id } : null,
    }, { status: 500 });
  }
}
