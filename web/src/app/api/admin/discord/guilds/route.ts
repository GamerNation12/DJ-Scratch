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

  const botToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Missing bot token" }, { status: 500 });
  }

  try {
    const discordRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: {
        "Authorization": `Bot ${botToken}`,
      },
      cache: "no-store",
    });

    if (!discordRes.ok) {
      console.error(`Discord Guilds Error: ${discordRes.status} ${discordRes.statusText}`);
      return NextResponse.json([]); // Return empty to prevent crashes
    }

    const text = await discordRes.text();
    if (!text) return NextResponse.json([]);
    
    try {
      const guilds = JSON.parse(text);
      if (!Array.isArray(guilds)) return NextResponse.json([]);
      return NextResponse.json(guilds);
    } catch (e) {
      return NextResponse.json([]);
    }
  } catch (error) {
    console.error("Internal Server Error fetching guilds:", error);
    return NextResponse.json([]);
  }
}
