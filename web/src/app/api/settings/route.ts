import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

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
    const row = await sql`
      SELECT fm_mode, show_features, private_mode, data_source, timezone, show_track_playcount, display_name 
      FROM user_settings 
      WHERE user_id = ${userId}
    `;
    const fmMode = row[0]?.fm_mode || "full";
    const showFeatures = row[0]?.show_features || false;
    const privateMode = row[0]?.private_mode || false;
    const dataSource = row[0]?.data_source || "combined";
    const timezone = row[0]?.timezone || "UTC";
    const showTrackPlaycount = row[0]?.show_track_playcount || false;
    const displayName = row[0]?.display_name || "";
    
    return NextResponse.json({ fmMode, showFeatures, privateMode, dataSource, timezone, showTrackPlaycount, displayName });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ fmMode: "full", showFeatures: false, privateMode: false, dataSource: "combined", timezone: "UTC", showTrackPlaycount: false });
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
    const { fmMode, showFeatures, privateMode, dataSource, timezone, showTrackPlaycount, displayName } = await req.json();
    
    let currentFmMode = "full";
    let currentShowFeatures = false;
    let currentPrivateMode = false;
    let currentDataSource = "combined";
    let currentTimezone = "UTC";
    let currentShowTrackPlaycount = false;
    let currentDisplayName = "";

    // Fetch current settings to handle partial updates
    const row = await sql`SELECT fm_mode, show_features, private_mode, data_source, timezone, show_track_playcount, display_name FROM user_settings WHERE user_id = ${userId}`;
    if (row.length > 0) {
      currentFmMode = row[0].fm_mode;
      currentShowFeatures = row[0].show_features || false;
      currentPrivateMode = row[0].private_mode || false;
      currentDataSource = row[0].data_source || "combined";
      currentTimezone = row[0].timezone || "UTC";
      currentShowTrackPlaycount = row[0].show_track_playcount || false;
      currentDisplayName = row[0].display_name || "";
    }

    const newFmMode = fmMode !== undefined ? fmMode : currentFmMode;
    const newShowFeatures = showFeatures !== undefined ? showFeatures : currentShowFeatures;
    const newPrivateMode = privateMode !== undefined ? privateMode : currentPrivateMode;
    const newDataSource = dataSource !== undefined ? dataSource : currentDataSource;
    const newTimezone = timezone !== undefined ? timezone : currentTimezone;
    const newShowTrackPlaycount = showTrackPlaycount !== undefined ? showTrackPlaycount : currentShowTrackPlaycount;
    const newDisplayName = displayName !== undefined ? (displayName.trim() || null) : currentDisplayName;

    if (newFmMode !== "compact" && newFmMode !== "full" && newFmMode !== "stats") {
      return NextResponse.json({ error: "Invalid layout mode" }, { status: 400 });
    }
    
    if (newDataSource !== "combined" && newDataSource !== "spotify" && newDataSource !== "lastfm") {
       return NextResponse.json({ error: "Invalid data source" }, { status: 400 });
    }

    await sql`
      INSERT INTO user_settings (user_id, fm_mode, show_features, private_mode, data_source, timezone, show_track_playcount, display_name)
      VALUES (${userId}, ${newFmMode}, ${newShowFeatures}, ${newPrivateMode}, ${newDataSource}, ${newTimezone}, ${newShowTrackPlaycount}, ${newDisplayName})
      ON CONFLICT (user_id) DO UPDATE SET 
        fm_mode = EXCLUDED.fm_mode, 
        show_features = EXCLUDED.show_features, 
        private_mode = EXCLUDED.private_mode,
        data_source = EXCLUDED.data_source,
        timezone = EXCLUDED.timezone,
        show_track_playcount = EXCLUDED.show_track_playcount,
        display_name = EXCLUDED.display_name
    `;

    // Log the change
    let changedItems = [];
    if (newFmMode !== currentFmMode) changedItems.push(`Layout: ${newFmMode}`);
    if (newShowFeatures !== currentShowFeatures) changedItems.push(`Show Features: ${newShowFeatures}`);
    if (newPrivateMode !== currentPrivateMode) changedItems.push(`Private Mode: ${newPrivateMode}`);
    if (newDataSource !== currentDataSource) changedItems.push(`Data Source: ${newDataSource}`);
    if (newTimezone !== currentTimezone) changedItems.push(`Timezone: ${newTimezone}`);
    if (newShowTrackPlaycount !== currentShowTrackPlaycount) changedItems.push(`Show Track Playcount: ${newShowTrackPlaycount}`);
    if (newDisplayName !== currentDisplayName) changedItems.push(`Display Name: ${newDisplayName || 'cleared'}`);
    
    if (changedItems.length > 0) {
      await sql`CREATE TABLE IF NOT EXISTS website_logs (id SERIAL PRIMARY KEY, user_id TEXT, username TEXT, action TEXT, details TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
      await sql`
        INSERT INTO website_logs (user_id, username, action, details)
        VALUES (${userId}, ${(session.user as any).name || 'Unknown'}, 'Settings Updated', ${changedItems.join(', ')})
      `;
      // Prevent database bloat by keeping only the last 200 logs
      await sql`
        DELETE FROM website_logs 
        WHERE id NOT IN (
          SELECT id FROM website_logs ORDER BY timestamp DESC LIMIT 200
        )
      `;
    }

    return NextResponse.json({ 
      success: true, 
      fmMode: newFmMode, 
      showFeatures: newShowFeatures, 
      privateMode: newPrivateMode,
      dataSource: newDataSource,
      timezone: newTimezone,
      showTrackPlaycount: newShowTrackPlaycount
    });
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
