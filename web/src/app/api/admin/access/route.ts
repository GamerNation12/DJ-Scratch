import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { getAdminRole } from '@/lib/admin';
import { sql } from "@/lib/db";

async function verifyOwner(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const decoded: any = await verifyToken(token);
  if (!decoded || !decoded.id) return null;
  const role = await getAdminRole(decoded.id);
  if (role !== 'owner') return null;
  return decoded.id;
}

export async function GET(req: Request) {
  const ownerId = await verifyOwner(req);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const res = await sql`SELECT value FROM global_settings WHERE key = 'admin_users'`;
    let adminUsers: { admins: string[], moderators: string[] } = { admins: [], moderators: [] };
    if (res.length > 0) {
      adminUsers = JSON.parse(res[0].value);
    }
    return NextResponse.json(adminUsers);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ownerId = await verifyOwner(req);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, role } = await req.json();
    if (!id || !['admin', 'moderator'].includes(role)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const res = await sql`SELECT value FROM global_settings WHERE key = 'admin_users'`;
    let adminUsers: { admins: string[], moderators: string[] } = { admins: [], moderators: [] };
    if (res.length > 0) {
      adminUsers = JSON.parse(res[0].value);
    }

    // Ensure arrays exist
    if (!adminUsers.admins) adminUsers.admins = [];
    if (!adminUsers.moderators) adminUsers.moderators = [];

    // Remove from existing roles first
    adminUsers.admins = adminUsers.admins.filter((uid: string) => uid !== id);
    adminUsers.moderators = adminUsers.moderators.filter((uid: string) => uid !== id);

    // Add to new role
    if (role === 'admin') adminUsers.admins.push(id);
    if (role === 'moderator') adminUsers.moderators.push(id);

    await sql`
      INSERT INTO global_settings (key, value) VALUES ('admin_users', ${JSON.stringify(adminUsers)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;

    return NextResponse.json({ success: true, adminUsers });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const ownerId = await verifyOwner(req);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const res = await sql`SELECT value FROM global_settings WHERE key = 'admin_users'`;
    let adminUsers: { admins: string[], moderators: string[] } = { admins: [], moderators: [] };
    if (res.length > 0) {
      adminUsers = JSON.parse(res[0].value);
    }

    if (adminUsers.admins) adminUsers.admins = adminUsers.admins.filter((uid: string) => uid !== id);
    if (adminUsers.moderators) adminUsers.moderators = adminUsers.moderators.filter((uid: string) => uid !== id);

    await sql`
      INSERT INTO global_settings (key, value) VALUES ('admin_users', ${JSON.stringify(adminUsers)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;

    return NextResponse.json({ success: true, adminUsers });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
