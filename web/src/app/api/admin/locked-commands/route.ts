import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { getAdminRole } from '@/lib/admin';
import { sql } from '@/lib/db';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const decoded: any = await verifyToken(token);
  
  if (!decoded || !decoded.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await getAdminRole(decoded.id);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const commands = await sql`
      SELECT command_name FROM disabled_commands ORDER BY command_name ASC
    `;
    return NextResponse.json(commands.map((row: any) => row.command_name));
  } catch (error) {
    console.error('Error fetching locked commands:', error);
    // Return empty array instead of 500 if table doesn't exist
    return NextResponse.json([]);
  }
}
