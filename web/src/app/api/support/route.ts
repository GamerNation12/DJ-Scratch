import { NextResponse } from "next/server";
import { discordAvatarUrl } from "@/lib/discord";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const GUILD_ID = "1527127381897383946";
const INVITE = "https://discord.gg/53sxaVWn92";

// Public support-server widget data. Guild preview needs no widget toggle;
// member avatars use the bot token (best-effort).
export async function GET() {
  try {
    const previewRes = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/preview`);
    if (!previewRes.ok) throw new Error(`preview ${previewRes.status}`);
    const preview = await previewRes.json();

    let members: { id: string; name: string; avatar: string | null }[] = [];
    const token = process.env.DISCORD_TOKEN;
    if (token) {
      try {
        const mRes = await fetch(
          `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=12`,
          { headers: { Authorization: `Bot ${token}` } }
        );
        if (mRes.ok) {
          const list = await mRes.json();
          members = (Array.isArray(list) ? list : [])
            .map((m: any) => ({
              id: String(m?.user?.id || ""),
              name: m?.user?.global_name || m?.user?.username || "?",
              avatar: m?.user ? discordAvatarUrl(String(m.user.id), m.user) : null,
            }))
            .filter((m) => m.id);
        }
      } catch {
        // avatars optional — counts still render
      }
    }

    const icon = preview.icon
      ? `https://cdn.discordapp.com/icons/${GUILD_ID}/${preview.icon}.png?size=256`
      : null;

    return NextResponse.json({
      name: preview.name || "DJ Scratch Support",
      icon,
      memberCount: preview.approximate_member_count ?? null,
      onlineCount: preview.approximate_presence_count ?? null,
      members,
      invite: INVITE,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Unavailable" }, { status: 502 });
  }
}
