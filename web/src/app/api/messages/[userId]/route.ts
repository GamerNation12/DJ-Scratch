import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { sendDiscordDM } from "@/lib/discord";

async function getUser(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  return token ? await verifyToken(token) : null;
}

export async function GET(
  req: Request,
  { params }: { params: { userId: string } }
) {
  const user = await getUser(req);
  if (!user || !(user as any).id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const myId = (user as any).id;
  const targetId = params.userId;

  try {
    const messages = await sql`
      SELECT id, sender_id, receiver_id, content, sent_at
      FROM direct_messages
      WHERE (sender_id = ${myId} AND receiver_id = ${targetId})
         OR (sender_id = ${targetId} AND receiver_id = ${myId})
      ORDER BY sent_at ASC
      LIMIT 100
    `;
    
    return NextResponse.json({ messages });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { userId: string } }
) {
  const user = await getUser(req);
  if (!user || !(user as any).id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const myId = (user as any).id;
  const targetId = params.userId;

  const { content } = await req.json();

  if (!content) {
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  }

  try {
    // Optional: check if they are friends
    const isFriend = await sql`
      SELECT status FROM friends WHERE user_id = ${myId} AND friend_id = ${targetId} AND status = 'accepted'
    `;
    if (isFriend.length === 0) {
      return NextResponse.json({ error: "Must be friends to send messages" }, { status: 403 });
    }

    const inserted = await sql`
      INSERT INTO direct_messages (sender_id, receiver_id, content)
      VALUES (${myId}, ${targetId}, ${content})
      RETURNING id, sent_at
    `;
    
    const message = inserted[0];
    
    // Fire off Discord DM asynchronously
    sendDiscordDM(
      params.userId, 
      `New DM from **${(user as any).name}** on DJ Scratch:\n\`${content}\`\n*(Reply on the website/app)*`
    ).catch(console.error);

    return NextResponse.json({ success: true, message: { id: message.id, sent_at: message.sent_at, sender_id: myId, receiver_id: targetId, content } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
