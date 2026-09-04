import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/spotify";
import { sql } from "@/lib/db";

// Lightweight link check (no Spotify API call). Used by Settings.
export async function GET(req: Request) {
  const myId = await getUserIdFromRequest(req);
  if (!myId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await sql`SELECT spotify_refresh_token FROM user_settings WHERE user_id = ${myId}`;
    return NextResponse.json({ linked: !!res[0]?.spotify_refresh_token });
  } catch {
    return NextResponse.json({ linked: false });
  }
}
