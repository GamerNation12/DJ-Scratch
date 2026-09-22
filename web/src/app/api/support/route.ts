import { NextResponse } from "next/server";
import { discordAvatarUrl } from "@/lib/discord";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const GUILD_ID = "1527127381897383946";
const INVITE = "https://discord.gg/53sxaVWn92";
const INVITE_CODE = "53sxaVWn92";
const OWNER_ID = "759433582107426816";

// Public support-server widget data. Guild preview needs no widget toggle;
// invite counts back it up if preview ever fails.
export async function GET() {
  let name = "DJ Scratch Support";
  let icon: string | null = null;
  let memberCount: number | null = null;
  let onlineCount: number | null = null;

  try {
    const previewRes = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/preview`);
    if (previewRes.ok) {
      const preview = await previewRes.json();
      name = preview.name || name;
      icon = preview.icon
        ? `https://cdn.discordapp.com/icons/${GUILD_ID}/${preview.icon}.png?size=256`
        : null;
      memberCount = preview.approximate_member_count ?? null;
      onlineCount = preview.approximate_presence_count ?? null;
    } else {
      throw new Error(`preview ${previewRes.status}`);
    }
  } catch {
    try {
      const invRes = await fetch(
        `https://discord.com/api/v10/invites/${INVITE_CODE}?with_counts=true`
      );
      if (invRes.ok) {
        const inv = await invRes.json();
        name = inv?.guild?.name || name;
        const iconHash = inv?.guild?.icon;
        icon = iconHash
          ? `https://cdn.discordapp.com/icons/${GUILD_ID}/${iconHash}.png?size=256`
          : null;
        memberCount = inv?.approximate_member_count ?? null;
        onlineCount = inv?.approximate_presence_count ?? null;
      }
    } catch {
      // counts stay null — card still renders with a Join button
    }
  }

  try {
    let members: { id: string; name: string; avatar: string | null }[] = [];
    const token = process.env.DISCORD_TOKEN;
    if (token) {
      try {
        const mRes = await fetch(
          `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=100`,
          { headers: { Authorization: `Bot ${token}` } }
        );
        if (mRes.ok) {
          const list = await mRes.json();
          // Bots don't count: humans only.
          const humans = (Array.isArray(list) ? list : []).filter((m: any) => !m?.user?.bot);
          if (Array.isArray(list) && list.length < 100) {
            memberCount = humans.length;
          }
          members = humans
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

    // Owner presence: true Discord presence needs the widget/presence
    // intent, so approximate via recent bot activity (15 min window).
    let ownerOnline = false;
    try {
      const rows = await sql`SELECT last_active FROM user_settings WHERE user_id = ${OWNER_ID}`;
      const last = rows.length > 0 ? (rows[0] as any).last_active : null;
      if (last) {
        ownerOnline = Date.now() - new Date(last).getTime() < 15 * 60 * 1000;
      }
    } catch {
      ownerOnline = false;
    }

    return NextResponse.json({ name, icon, memberCount, onlineCount, members, invite: INVITE, ownerOnline });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Unavailable" }, { status: 502 });
  }
}
