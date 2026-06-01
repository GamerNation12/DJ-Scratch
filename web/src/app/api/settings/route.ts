import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";
import { neon } from "@neondatabase/serverless";

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const sql = neon(DB_URL!);
    const row = await sql`
      SELECT fm_mode FROM user_settings WHERE user_id = ${userId}
    `;
    const fmMode = row[0]?.fm_mode || "full";
    return NextResponse.json({ fmMode });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ fmMode: "full" });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const { fmMode } = await req.json();
    if (fmMode !== "compact" && fmMode !== "full") {
      return NextResponse.json({ error: "Invalid layout mode" }, { status: 400 });
    }

    const sql = neon(DB_URL!);
    await sql`
      INSERT INTO user_settings (user_id, fm_mode)
      VALUES (${userId}, ${fmMode})
      ON CONFLICT (user_id) DO UPDATE SET fm_mode = EXCLUDED.fm_mode
    `;

    return NextResponse.json({ success: true, fmMode });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
