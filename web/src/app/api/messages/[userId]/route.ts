import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendDiscordDM } from "@/lib/discord";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getUser(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  return token ? await verifyToken(token) : null;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await context.params;
  const myId = (user as any).id;
  const targetId = params.userId;

  try {
    const messages = await sql`
      SELECT id, sender_id, receiver_id, content, sent_at, read_at, reactions
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
  context: { params: Promise<{ userId: string }> }
) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await context.params;
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
      `New DM from **${(user as any).name}** on DJ Scratch:\n\`${content}\`\n*(Reply on the website/app or click below)*`,
      [
        {
          type: 1, // ActionRow
          components: [
            {
              type: 2, // Button
              label: "Reply via Discord",
              style: 1, // Primary/Blurple
              custom_id: `reply_dm_${myId}`
            }
          ]
        }
      ]
    ).catch(console.error);

    // Fire off log to bot
    fetch("http://mango.fps.ms:20544/log_dm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_id: myId, receiver_id: targetId })
    }).catch(console.error);

    return NextResponse.json({ success: true, message: { id: message.id, sent_at: message.sent_at, sender_id: myId, receiver_id: targetId, content } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await context.params;
  const myId = (user as any).id;
  const senderId = params.userId; // The person who sent the messages we are now reading

  try {
    await sql`
      UPDATE direct_messages 
      SET read_at = CURRENT_TIMESTAMP
      WHERE sender_id = ${senderId} 
        AND receiver_id = ${myId} 
        AND read_at IS NULL
    `;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
