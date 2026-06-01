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
      SELECT fm_mode, show_features FROM user_settings WHERE user_id = ${userId}
    `;
    const fmMode = row[0]?.fm_mode || "full";
    const showFeatures = row[0]?.show_features || false;
    return NextResponse.json({ fmMode, showFeatures });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ fmMode: "full", showFeatures: false });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const { fmMode, showFeatures } = await req.json();
    
    let currentFmMode = "full";
    let currentShowFeatures = false;

    const sql = neon(DB_URL!);
    
    // Fetch current settings to handle partial updates
    const row = await sql`SELECT fm_mode, show_features FROM user_settings WHERE user_id = ${userId}`;
    if (row.length > 0) {
      currentFmMode = row[0].fm_mode;
      currentShowFeatures = row[0].show_features || false;
    }

    const newFmMode = fmMode !== undefined ? fmMode : currentFmMode;
    const newShowFeatures = showFeatures !== undefined ? showFeatures : currentShowFeatures;

    if (newFmMode !== "compact" && newFmMode !== "full") {
      return NextResponse.json({ error: "Invalid layout mode" }, { status: 400 });
    }

    await sql`
      INSERT INTO user_settings (user_id, fm_mode, show_features)
      VALUES (${userId}, ${newFmMode}, ${newShowFeatures})
      ON CONFLICT (user_id) DO UPDATE SET fm_mode = EXCLUDED.fm_mode, show_features = EXCLUDED.show_features
    `;

    return NextResponse.json({ success: true, fmMode: newFmMode, showFeatures: newShowFeatures });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
