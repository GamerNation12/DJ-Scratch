import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Badge catalog mirrors discord-bot src/core/database.py REFERRAL_BADGES.
const BADGES: Record<string, { emoji: string; name: string; desc: string }> = {
  referred: { emoji: "💫", name: "Referred", desc: "Joined DJ Scratch through a friend's invite link." },
  recruiter: { emoji: "📣", name: "Recruiter", desc: "A friend joined through your invite link." },
  super_recruiter: { emoji: "🌟", name: "Super Recruiter", desc: "5 friends joined through your invite link." },
  referral_royalty: { emoji: "👑", name: "Referral Royalty", desc: "25 friends joined through your invite link." },
};

async function getUser(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  return token ? await verifyToken(token) : null;
}

function newCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

// GET: my referral code + invite stats + badges.
export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user || !(user as any).id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = String((user as any).id);

  try {
    let rows = await sql`SELECT code FROM referral_codes WHERE user_id = ${userId}`;
    let code: string | null = rows.length > 0 ? (rows[0] as any).code : null;
    if (!code) {
      for (let i = 0; i < 5 && !code; i++) {
        const candidate = newCode();
        try {
          await sql`INSERT INTO referral_codes (user_id, code) VALUES (${userId}, ${candidate}) ON CONFLICT (user_id) DO NOTHING`;
          const r2 = await sql`SELECT code FROM referral_codes WHERE user_id = ${userId}`;
          if (r2.length > 0) code = (r2[0] as any).code;
        } catch {
          // code collision — retry with a fresh one
        }
      }
    }
    if (!code) return NextResponse.json({ error: "Could not issue code" }, { status: 500 });

    const clicks = await sql`SELECT COUNT(*)::int AS c FROM referral_clicks WHERE sharer_id = ${userId}`;
    const completed = await sql`SELECT COUNT(*)::int AS c FROM referral_clicks WHERE sharer_id = ${userId} AND rewarded_at IS NOT NULL`;
    const badgeRows = await sql`SELECT badge FROM user_badges WHERE user_id = ${userId}`;
    const badges = (badgeRows as any[])
      .map((r) => r.badge)
      .filter((b) => b in BADGES)
      .map((b) => ({ key: b, ...BADGES[b] }));

    return NextResponse.json({
      code,
      clicks: (clicks[0] as any)?.c ?? 0,
      completed: (completed[0] as any)?.c ?? 0,
      badges,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// POST { code }: record that the authed user arrived via someone's invite link.
// Rewarding happens bot-side once they link Last.fm (both sides earn a badge).
export async function POST(req: Request) {
  const user = await getUser(req);
  if (!user || !(user as any).id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const friendId = String((user as any).id);

  let code: string | null = null;
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code.trim().toLowerCase() : null;
  } catch {
    code = null;
  }
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  try {
    const codeRows = await sql`SELECT user_id FROM referral_codes WHERE code = ${code}`;
    if (codeRows.length === 0) return NextResponse.json({ error: "Invalid code" }, { status: 404 });
    const sharerId = String((codeRows[0] as any).user_id);
    if (sharerId === friendId) return NextResponse.json({ error: "That's your own link" }, { status: 400 });

    await sql`
      INSERT INTO referral_clicks (code, sharer_id, friend_id)
      VALUES (${code}, ${sharerId}, ${friendId})
      ON CONFLICT (code, friend_id) DO NOTHING
    `;
    const sharerName = await sql`SELECT display_name, discord_username FROM user_settings WHERE user_id = ${sharerId}`;
    return NextResponse.json({
      success: true,
      sharer: (sharerName[0] as any)?.display_name || (sharerName[0] as any)?.discord_username || "your friend",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
