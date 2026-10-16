import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function authedId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;
  const id = (user as any)?.id;
  return id ? String(id) : null;
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      fcm_token TEXT PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL,
      platform TEXT NOT NULL DEFAULT 'android',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions (user_id)`;
}

// POST { fcmToken, platform }: register this device for push.
export async function POST(req: Request) {
  const userId = await authedId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let fcmToken = "";
  let platform = "android";
  try {
    const body = await req.json();
    fcmToken = String(body?.fcmToken || "");
    if (body?.platform) platform = String(body.platform).slice(0, 16);
  } catch { /* fall through to 400 */ }
  if (!fcmToken || fcmToken.length > 512) {
    return NextResponse.json({ error: "Missing fcmToken" }, { status: 400 });
  }
  try {
    await ensureTable();
    await sql`
      INSERT INTO push_subscriptions (fcm_token, user_id, platform)
      VALUES (${fcmToken}, ${userId}, ${platform})
      ON CONFLICT (fcm_token) DO UPDATE SET user_id = ${userId}, platform = ${platform}, updated_at = CURRENT_TIMESTAMP
    `;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// DELETE { fcmToken }: stop pushes for this device (logout).
export async function DELETE(req: Request) {
  const userId = await authedId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let fcmToken = "";
  try {
    fcmToken = String((await req.json())?.fcmToken || "");
  } catch { /* fall through */ }
  if (!fcmToken) return NextResponse.json({ error: "Missing fcmToken" }, { status: 400 });
  try {
    await ensureTable();
    await sql`DELETE FROM push_subscriptions WHERE fcm_token = ${fcmToken} AND user_id = ${userId}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
