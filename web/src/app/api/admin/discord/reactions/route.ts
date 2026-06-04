import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any)?.id !== "759433582107426816") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { channelId, messageId, emoji } = await req.json();

    if (!channelId || !messageId || !emoji) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const botToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: "Missing bot token" }, { status: 500 });
    }

    // URI encode the emoji
    const encodedEmoji = encodeURIComponent(emoji);

    const discordRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`, {
      method: "PUT",
      headers: {
        "Authorization": `Bot ${botToken}`,
      },
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      console.error("Discord React Error:", errText);
      return NextResponse.json({ error: "Failed to add reaction" }, { status: discordRes.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Internal Server Error adding reaction:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
