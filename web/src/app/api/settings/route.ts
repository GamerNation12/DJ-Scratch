import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;
  const session = user ? { user } : null;

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const sql = neon(DB_URL!);
    const row = await sql`
      SELECT fm_mode, show_features, private_mode FROM user_settings WHERE user_id = ${userId}
    `;
    const fmMode = row[0]?.fm_mode || "full";
    const showFeatures = row[0]?.show_features || false;
    const privateMode = row[0]?.private_mode || false;
    return NextResponse.json({ fmMode, showFeatures, privateMode });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ fmMode: "full", showFeatures: false, privateMode: false });
  }
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;
  const session = user ? { user } : null;

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const { fmMode, showFeatures, privateMode } = await req.json();
    
    let currentFmMode = "full";
    let currentShowFeatures = false;
    let currentPrivateMode = false;

    const sql = neon(DB_URL!);
    
    // Fetch current settings to handle partial updates
    const row = await sql`SELECT fm_mode, show_features, private_mode FROM user_settings WHERE user_id = ${userId}`;
    if (row.length > 0) {
      currentFmMode = row[0].fm_mode;
      currentShowFeatures = row[0].show_features || false;
      currentPrivateMode = row[0].private_mode || false;
    }

    const newFmMode = fmMode !== undefined ? fmMode : currentFmMode;
    const newShowFeatures = showFeatures !== undefined ? showFeatures : currentShowFeatures;
    const newPrivateMode = privateMode !== undefined ? privateMode : currentPrivateMode;

    if (newFmMode !== "compact" && newFmMode !== "full" && newFmMode !== "stats") {
      return NextResponse.json({ error: "Invalid layout mode" }, { status: 400 });
    }

    await sql`
      INSERT INTO user_settings (user_id, fm_mode, show_features, private_mode)
      VALUES (${userId}, ${newFmMode}, ${newShowFeatures}, ${newPrivateMode})
      ON CONFLICT (user_id) DO UPDATE SET fm_mode = EXCLUDED.fm_mode, show_features = EXCLUDED.show_features, private_mode = EXCLUDED.private_mode
    `;

    return NextResponse.json({ success: true, fmMode: newFmMode, showFeatures: newShowFeatures, privateMode: newPrivateMode });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
