import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any)?.id !== "759433582107426816") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const botToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: "Missing bot token" }, { status: 500 });
    }

    const discordRes = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
      method: "POST",
      headers: {
        "Authorization": `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: userId }),
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      console.error("Discord DM Error:", errText);
      return NextResponse.json({ error: "Failed to open DM" }, { status: discordRes.status });
    }

    const text = await discordRes.text();
    if (!text) return NextResponse.json({ error: "Empty response from Discord" }, { status: 500 });
    
    try {
      const channel = JSON.parse(text);
      if (channel.message) return NextResponse.json({ error: channel.message }, { status: 400 });
      return NextResponse.json(channel);
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON from Discord" }, { status: 500 });
    }
  } catch (error) {
    console.error("Internal Server Error opening DM:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
