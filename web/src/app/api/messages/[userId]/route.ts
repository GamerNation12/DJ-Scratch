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
      SELECT id, sender_id, receiver_id, content, sent_at, read_at, reactions, is_bot
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
    // Auto Mod Filter
    const badWords = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut', 'dick', 'cock', 'pussy'];
    let filteredContent = content;
    let isCensored = false;
    
    // Check for extreme spam/scam links
    const spamLinks = ['discord.gg/', 'steamcommunity.com-gift', 'free-nitro'];
    if (spamLinks.some(link => content.toLowerCase().includes(link))) {
      return NextResponse.json({ error: "AutoMod: Message blocked due to suspicious links." }, { status: 403 });
    }

    // Censor bad words
    for (const word of badWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(filteredContent)) {
        filteredContent = filteredContent.replace(regex, '*'.repeat(word.length));
        isCensored = true;
      }
    }
    
    // Optional: check if they are friends
    const isFriend = await sql`
      SELECT status FROM friends WHERE user_id = ${myId} AND friend_id = ${targetId} AND status = 'accepted'
    `;
    if (isFriend.length === 0) {
      return NextResponse.json({ error: "Must be friends to send messages" }, { status: 403 });
    }

    const inserted = await sql`
      INSERT INTO direct_messages (sender_id, receiver_id, content)
      VALUES (${myId}, ${targetId}, ${filteredContent})
      RETURNING id, sent_at
    `;
    
    const message = inserted[0];
    
    // Fire off Discord DM asynchronously
    sendDiscordDM(
      params.userId, 
      `New DM from **${(user as any).name}** on DJ Scratch:\n\`${filteredContent}\`\n*(To reply, launch the DJ Scratch Activity using the 🚀 icon below, or click the button)*`,
      [
        {
          type: 1, // ActionRow
          components: [
            {
              type: 2, // Button
              label: "Open Web Dashboard",
              style: 5, // Link
              url: "https://the-goats-dj.vercel.app/messages"
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

    // If it's a command, execute it via the bot
    if (content.startsWith(",")) {
      fetch("http://mango.fps.ms:20544/run_web_command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender_id: myId, command: content })
      })
      .then(res => res.json())
      .then(async data => {
        if (data.result) {
          // Insert the bot's reply into the DB as if it was sent by the original user
          // That way it shows up in the same chat!
          const botRes = await sql`
            INSERT INTO direct_messages (sender_id, receiver_id, content, sent_at, is_bot)
            VALUES (${myId}, ${targetId}, ${data.result}, NOW(), TRUE)
            RETURNING id, sent_at
          `;
          
          const botMessageId = botRes[0].id;
          const botSentAt = botRes[0].sent_at;
          
          // Broadcast bot reply to the receiver
          fetch("http://mango.fps.ms:20544/log_dm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              sender_id: myId, 
              receiver_id: targetId,
              msg_data: { id: botMessageId, sender_id: myId, receiver_id: targetId, content: data.result, sent_at: botSentAt, is_bot: true }
            })
          }).catch(console.error);

          // Broadcast bot reply to the sender (so they see it instantly too)
          fetch("http://mango.fps.ms:20544/log_dm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              sender_id: targetId, // Flip sender/receiver to emit to 'myId'
              receiver_id: myId,
              msg_data: { id: botMessageId, sender_id: myId, receiver_id: targetId, content: data.result, sent_at: botSentAt, is_bot: true }
            })
          }).catch(console.error);
        }
      })
      .catch(console.error);
    }

    return NextResponse.json({ success: true, message: { id: message.id, sent_at: message.sent_at, sender_id: myId, receiver_id: targetId, content: filteredContent, isCensored } });
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
    
    // Broadcast messages_read event to the sender
    fetch("http://mango.fps.ms:20544/log_dm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        sender_id: myId, 
        receiver_id: senderId,
        msg_data: { type: 'messages_read', receiver_id: senderId }
      })
    }).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
