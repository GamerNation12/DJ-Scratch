import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;
  const session = user ? { user } : null;

  if (!session || (session.user as any)?.id !== "759433582107426816") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get("channelId");

  if (!channelId) {
    return NextResponse.json({ error: "Missing channelId" }, { status: 400 });
  }

  const botToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Missing bot token" }, { status: 500 });
  }

  try {
    const discordRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=50`, {
      headers: {
        "Authorization": `Bot ${botToken}`,
      },
      cache: "no-store",
    });

    if (!discordRes.ok) {
      console.error(`Discord Messages Error: ${discordRes.status} ${discordRes.statusText}`);
      return NextResponse.json([]); // Prevent crash
    }

    const text = await discordRes.text();
    if (!text) return NextResponse.json([]);

    try {
      const messages = JSON.parse(text);
      if (!Array.isArray(messages)) return NextResponse.json([]);
      return NextResponse.json(messages);
    } catch (e) {
      return NextResponse.json([]);
    }
  } catch (error) {
    console.error("Internal Server Error fetching messages:", error);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;
  const session = user ? { user } : null;

  if (!session || (session.user as any)?.id !== "759433582107426816") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { channelId, content, replyToId } = await req.json();

    if (!channelId || !content) {
      return NextResponse.json({ error: "Missing channelId or content" }, { status: 400 });
    }

    const botToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: "Missing bot token" }, { status: 500 });
    }

    const payload: any = { content };
    if (replyToId) {
      payload.message_reference = { message_id: replyToId };
    }

    const discordRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      console.error("Discord Send Error:", errText);
      return NextResponse.json({ error: "Failed to send message" }, { status: discordRes.status });
    }

    const msg = await discordRes.json();
    return NextResponse.json(msg);
  } catch (error) {
    console.error("Internal Server Error sending message:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
