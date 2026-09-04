import postgres from "postgres";

export type LoginRefreshParams = {
  channelId?: string | null;
  messageId?: string | null;
  userId: string;
  siteOrigin: string;
  /** Last.fm name just linked (Last.fm flow). Otherwise read from the DB. */
  linkedLastfmUsername?: string | null;
};

const FOOTER = { text: "DJ Scratch • Seamless Music Experience" };

/**
 * Re-render a `,login` / `/login` Discord message to match the user's current
 * link state (mirrors the bot's login matrix). Best-effort: returns false
 * instead of throwing, so auth flows never break over a message edit.
 */
export async function refreshLoginMessage(params: LoginRefreshParams): Promise<boolean> {
  const { channelId, messageId, userId, siteOrigin } = params;
  const botToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
  if (!botToken || !channelId || !messageId || !userId) return false;

  let lastfmUsername: string | null = params.linkedLastfmUsername || null;
  let spotifyLinked = false;
  try {
    const sql = postgres(process.env.DATABASE_URL || process.env.POSTGRES_URL || "");
    const rows = await sql`SELECT lastfm_username, spotify_refresh_token FROM user_settings WHERE user_id = ${String(userId)}`;
    if (rows.length > 0) {
      lastfmUsername = lastfmUsername || rows[0].lastfm_username || null;
      spotifyLinked = !!rows[0].spotify_refresh_token;
    }
    await sql.end().catch(() => {});
  } catch {
    return false; // DB unreachable: don't touch the message
  }

  if (!lastfmUsername && !spotifyLinked) return false;

  const spotifyUrl =
    `${siteOrigin}/api/auth/spotify` +
    `?user_id=${encodeURIComponent(String(userId))}` +
    `&channel_id=${encodeURIComponent(String(channelId))}` +
    `&message_id=${encodeURIComponent(String(messageId))}`;

  let embed: Record<string, unknown>;
  let components: unknown[] = [];
  if (lastfmUsername && spotifyLinked) {
    embed = {
      title: "✅ All Linked",
      description:
        `Last.fm linked as **${lastfmUsername}**.\n` +
        "🎵 Spotify linked — remote control and the Music dashboard are ready.",
      color: 0x2ecc71,
      footer: FOOTER,
    };
  } else if (lastfmUsername) {
    embed = {
      title: "✅ Last.fm Linked",
      description:
        `You are logged in as **${lastfmUsername}**.\n\n` +
        "🎵 Spotify is **not** linked yet — add it for playback control, likes, and the Music dashboard.",
      color: 0x2ecc71,
      footer: FOOTER,
    };
    components = [{ type: 1, components: [
      { type: 2, style: 5, label: "Login with Spotify", url: spotifyUrl, emoji: { name: "🎵" } },
    ] }];
  } else {
    const cb =
      `${siteOrigin}/login-callback/?discord_id=${encodeURIComponent(String(userId))}` +
      `&channel_id=${encodeURIComponent(String(channelId))}` +
      `&message_id=${encodeURIComponent(String(messageId))}`;
    const apiKey = process.env.LASTFM_API_KEY;
    embed = {
      title: "🔗 Connect Your Music",
      description:
        "**DJ Scratch uses Last.fm to track your listening history.**\n\n" +
        "Click a button below to link an account.\n\n🎵 Spotify already linked.",
      color: 0xe74c3c,
      footer: FOOTER,
    };
    const btns: unknown[] = [];
    if (apiKey) {
      btns.push({
        type: 2, style: 5, label: "Login with Last.fm",
        url: `https://www.last.fm/api/auth/?api_key=${apiKey}&cb=${encodeURIComponent(cb)}`,
        emoji: { name: "🔗" },
      });
    }
    btns.push({ type: 2, style: 5, label: "Login with Spotify", url: spotifyUrl, emoji: { name: "🎵" } });
    components = [{ type: 1, components: btns }];
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed], components }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
