import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { getAdminRole } from '@/lib/admin';
import { Pool } from "pg";

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

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query("SELECT value FROM global_settings WHERE key = 'admin_users'");
    let adminUsers: { admins: string[], moderators: string[] } = { admins: [], moderators: [] };
    if (res.rows.length > 0) {
      adminUsers = JSON.parse(res.rows[0].value);
    }
    return NextResponse.json(adminUsers);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  } finally {
    await pool.end();
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

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const res = await pool.query("SELECT value FROM global_settings WHERE key = 'admin_users'");
      let adminUsers: { admins: string[], moderators: string[] } = { admins: [], moderators: [] };
      if (res.rows.length > 0) {
        adminUsers = JSON.parse(res.rows[0].value);
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

      await pool.query(
        "INSERT INTO global_settings (key, value) VALUES ('admin_users', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [JSON.stringify(adminUsers)]
      );

      return NextResponse.json({ success: true, adminUsers });
    } finally {
      await pool.end();
    }
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

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const res = await pool.query("SELECT value FROM global_settings WHERE key = 'admin_users'");
      let adminUsers: { admins: string[], moderators: string[] } = { admins: [], moderators: [] };
      if (res.rows.length > 0) {
        adminUsers = JSON.parse(res.rows[0].value);
      }
      
      if (adminUsers.admins) adminUsers.admins = adminUsers.admins.filter((uid: string) => uid !== id);
      if (adminUsers.moderators) adminUsers.moderators = adminUsers.moderators.filter((uid: string) => uid !== id);

      await pool.query(
        "INSERT INTO global_settings (key, value) VALUES ('admin_users', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [JSON.stringify(adminUsers)]
      );

      return NextResponse.json({ success: true, adminUsers });
    } finally {
      await pool.end();
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
