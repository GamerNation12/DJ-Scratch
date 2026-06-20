import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;
  const session = user ? { user } : null;

  if (!session || (session.user as any)?.id !== "759433582107426816") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { actionType, payload } = body;

    if (!actionType || !["SYNC_COMMANDS", "RESTART_BOT", "CLEAR_DUPLICATES", "SEND_MESSAGE", "SET_GLOBAL_UPDATE"].includes(actionType)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (actionType === "SET_GLOBAL_UPDATE") {
      const version = payload?.version;
      const message = payload?.message;

      if (!version || !message) {
        return NextResponse.json({ error: "Missing version or message" }, { status: 400 });
      }

      // Keep DB update so it persists across bot restarts
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      await pool.query(
        "INSERT INTO global_settings (key, value) VALUES ('current_update_version', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [version]
      );
      await pool.query(
        "INSERT INTO global_settings (key, value) VALUES ('current_update_message', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [message]
      );
      await pool.end();

      // Send IPC message to notify bot instantly
      await sendDiscordIPC(`[WEBSITE] SET_GLOBAL_UPDATE|${version}|${message}`);
      return NextResponse.json({ success: true, message: "Global update notification updated successfully!" });
    }

    if (actionType === "SEND_MESSAGE") {
      const channelId = payload?.channelId;
      const content = payload?.content;
      const embeds = payload?.embeds;

      if (!channelId || (!content && !embeds)) {
        return NextResponse.json({ error: "Missing channelId or content/embeds" }, { status: 400 });
      }

      const botToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
      if (!botToken) return NextResponse.json({ error: "Missing bot token" }, { status: 500 });

      const bodyData: any = {};
      if (content) bodyData.content = content;
      if (embeds) bodyData.embeds = embeds;

      const discordRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Authorization": `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });

      if (!discordRes.ok) return NextResponse.json({ error: "Failed to send message to Discord" }, { status: discordRes.status });
      return NextResponse.json({ success: true, message: "Message sent directly via Discord API!" });
    }

    // For other actions, just send an IPC message to Discord
    await sendDiscordIPC(`[WEBSITE] ${actionType}`);
    return NextResponse.json({ success: true, message: `Action ${actionType} queued via Discord IPC.` });
  } catch (error) {
    console.error("Failed to process bot action:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function sendDiscordIPC(content: string) {
  const botToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
  if (!botToken) return;

  const channelId = "1517288950522187947";
  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content }),
  });
}
