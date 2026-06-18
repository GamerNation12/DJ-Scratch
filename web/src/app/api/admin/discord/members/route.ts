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
  const guildId = searchParams.get("guildId");

  if (!guildId) {
    return NextResponse.json({ error: "Missing guildId" }, { status: 400 });
  }

  const botToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Missing bot token" }, { status: 500 });
  }

  try {
    const discordRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
      headers: {
        "Authorization": `Bot ${botToken}`,
      },
      cache: "no-store",
    });

    if (!discordRes.ok) {
      console.error(`Discord Members Error: ${discordRes.status} ${discordRes.statusText}`);
      return NextResponse.json([]); // Prevent crash
    }

    const text = await discordRes.text();
    if (!text) return NextResponse.json([]);

    try {
      const members = JSON.parse(text);
      if (!Array.isArray(members)) return NextResponse.json([]);
      return NextResponse.json(members);
    } catch (e) {
      return NextResponse.json([]);
    }
  } catch (error) {
    console.error("Internal Server Error fetching members:", error);
    return NextResponse.json([]);
  }
}
