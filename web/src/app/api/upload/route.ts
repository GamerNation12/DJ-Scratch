import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";
import { neon } from "@neondatabase/serverless";

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

type Track = { artist: string; title: string; album: string; playedAt: string };

async function sendDiscordDM(userId: string, content: string) {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.error("DISCORD_TOKEN is not set in the environment variables.");
    return;
  }

  try {
    // 1. Create DM channel
    const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: userId }),
    });

    if (!dmRes.ok) {
      console.error("Failed to create DM channel:", await dmRes.text());
      return;
    }

    const dmChannel = await dmRes.json();
    const channelId = dmChannel.id;

    // 2. Send message
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    if (!msgRes.ok) {
      console.error("Failed to send DM message:", await msgRes.text());
    }
  } catch (err) {
    console.error("Error sending DM:", err);
  }
}

async function processImportInBackground(userId: string, username: string, tracks: Track[]) {
  if (!DB_URL) return;
  const sql = neon(DB_URL);
  const chunkSize = 500;
  let processedCount = 0;

  for (let i = 0; i < tracks.length; i += chunkSize) {
    const chunk = tracks.slice(i, i + chunkSize);
    try {
      await sql.transaction(
        chunk.map((t) =>
          sql`
            INSERT INTO listens (user_id, artist_name, track_name, album_name, played_at)
            VALUES (${userId}, ${t.artist}, ${t.title}, ${t.album}, ${t.playedAt})
            ON CONFLICT (user_id, artist_name, track_name, played_at) DO NOTHING
          `
        )
      );
      processedCount += chunk.length;
    } catch (err) {
      console.error("Failed inserting batch in background:", err);
    }
  }

  // Send DM when finished!
  await sendDiscordDM(
    userId,
    `✅ **Spotify Import Complete!**\n` +
    `Hey **${username}**, your Spotify history has finished importing!\n` +
    `• **${processedCount.toLocaleString()}** tracks processed.\n` +
    `You can now use bot commands like \`/profile\` or \`/topartists\` to see your updated stats!`
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const username = session.user.name || "Unknown";

  try {
    const tracksPayload = await req.json();
    if (!Array.isArray(tracksPayload) || tracksPayload.length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Validate it looks like Spotify data
    const sample = tracksPayload[0];
    const isSpotifyData =
      "trackName" in sample || "master_metadata_track_name" in sample;
    if (!isSpotifyData) {
      return NextResponse.json(
        { error: "Invalid data format. Does not match Spotify schema." },
        { status: 400 }
      );
    }

    const sql = neon(DB_URL!);

    // Ensure user exists
    await sql`
      INSERT INTO imported_users (id, username)
      VALUES (${userId}, ${username})
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username
    `;

    // Build valid tracks list
    const validTracks: Track[] = [];

    for (const track of tracksPayload) {
      const artist = track.artistName || track.master_metadata_album_artist_name;
      const title = track.trackName || track.master_metadata_track_name;
      const album = track.master_metadata_album_album_name || "";
      const playedAtRaw = track.endTime || track.ts;
      const msPlayed = track.msPlayed || track.ms_played || 0;

      if (!artist || !title || !playedAtRaw || msPlayed < 30000) continue;

      try {
        validTracks.push({ artist, title, album, playedAt: new Date(playedAtRaw).toISOString() });
      } catch {
        continue;
      }
    }

    if (validTracks.length === 0) {
      return NextResponse.json({ success: true, message: "No valid tracks to import." });
    }

    // Process the import in the background (asynchronous) so they can close the site immediately
    processImportInBackground(userId, username, validTracks);

    return NextResponse.json({
      success: true,
      message: `Upload complete! Successfully received ${validTracks.length.toLocaleString()} tracks. The bot will DM you on Discord when the database import is fully finished. You can now close this tab!`
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
