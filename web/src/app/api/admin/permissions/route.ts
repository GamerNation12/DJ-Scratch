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
    const permissions = await sql`
      SELECT user_id, command_name, granted_at 
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
    const { userId, commandName } = body;

    if (!userId || !commandName) {
      return NextResponse.json({ error: 'userId and commandName are required' }, { status: 400 });
    }

    await sql`
      INSERT INTO command_permissions (user_id, command_name) 
      VALUES (${userId}, ${commandName})
      ON CONFLICT DO NOTHING
    `;
    
    await sendDiscordIPC(`[WEBSITE] PERMISSION_GRANT|${userId}|${commandName}`);
    
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
