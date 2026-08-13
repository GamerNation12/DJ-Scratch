import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

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


export async function GET() {
  try {
    // Ensure table exists (fixes 500 errors if bot hasn't run migrations)
    await sql`
      CREATE TABLE IF NOT EXISTS command_permissions (
          user_id TEXT,
          command_name TEXT,
          granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP,
          PRIMARY KEY (user_id, command_name)
      )
    `;
    
    // Add expires_at if it's an old table
    try {
      await sql`ALTER TABLE command_permissions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`;
    } catch (e) {
      // Ignore error if column already exists or syntax not supported
    }

    const permissions = await sql`
      SELECT user_id, command_name, granted_at, expires_at 
      FROM command_permissions 
      ORDER BY granted_at DESC
    `;
    return NextResponse.json(permissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, commandName, duration } = body;

    if (!userId || !commandName) {
      return NextResponse.json({ error: 'userId and commandName are required' }, { status: 400 });
    }

    let expiresAt = null;
    if (duration && duration !== 'permanent') {
      const now = new Date();
      if (duration === '1h') now.setHours(now.getHours() + 1);
      else if (duration === '1d') now.setDate(now.getDate() + 1);
      else if (duration === '1w') now.setDate(now.getDate() + 7);
      else if (duration === '1m') now.setMonth(now.getMonth() + 1);
      expiresAt = now;
    }

    if (expiresAt) {
      await sql`
        INSERT INTO command_permissions (user_id, command_name, expires_at) 
        VALUES (${userId}, ${commandName}, ${expiresAt})
        ON CONFLICT (user_id, command_name) DO UPDATE SET expires_at = EXCLUDED.expires_at
      `;
    } else {
      await sql`
        INSERT INTO command_permissions (user_id, command_name) 
        VALUES (${userId}, ${commandName})
        ON CONFLICT (user_id, command_name) DO UPDATE SET expires_at = NULL
      `;
    }
    
    await sendDiscordIPC(`[WEBSITE] PERMISSION_GRANT|${userId}|${commandName}|${duration || 'permanent'}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding permission:', error);
    return NextResponse.json({ error: 'Failed to add permission' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { userId, commandName } = body;

    if (!userId || !commandName) {
      return NextResponse.json({ error: 'userId and commandName are required' }, { status: 400 });
    }

    await sql`
      DELETE FROM command_permissions 
      WHERE user_id = ${userId} AND command_name = ${commandName}
    `;
    
    await sendDiscordIPC(`[WEBSITE] PERMISSION_REVOKE|${userId}|${commandName}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting permission:', error);
    return NextResponse.json({ error: 'Failed to delete permission' }, { status: 500 });
  }
}
