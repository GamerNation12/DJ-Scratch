export async function sendDiscordDM(userId: string, content: string) {
  const token = process.env.DISCORD_TOKEN;
  if (!token) return false;

  try {
    // 1. Create DM channel
    const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        "Authorization": `Bot ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ recipient_id: userId })
    });

    if (!dmRes.ok) return false;
    const dmData = await dmRes.json();
    const channelId = dmData.id;

    // 2. Send Message
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bot ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content })
    });

    return msgRes.ok;
  } catch (error) {
    console.error("Failed to send Discord DM:", error);
    return false;
  }
}
