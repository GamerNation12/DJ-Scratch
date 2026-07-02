import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId, emoji } = await req.json();
  if (!messageId || !emoji) return NextResponse.json({ error: "Missing data" }, { status: 400 });

  const myId = (user as any).id;

  try {
    // Append the reaction to the reactions JSONB array
    await sql`
      UPDATE direct_messages 
      SET reactions = reactions || ${JSON.stringify([emoji])}::jsonb
      WHERE id = ${messageId}
    `;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
