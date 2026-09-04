import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/spotify";
import { sql } from "@/lib/db";

// Drop all stored Spotify tokens for the authenticated user.
export async function POST(req: Request) {
  const myId = await getUserIdFromRequest(req);
  if (!myId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await sql`UPDATE user_settings SET spotify_access_token = NULL, spotify_refresh_token = NULL, spotify_token_expires_at = NULL WHERE user_id = ${myId}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Spotify disconnect error:", e);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
