import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { getAdminRole } from '@/lib/admin';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ role: null }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const decoded = await verifyToken(token);
  
  if (!decoded || !decoded.id) {
    return NextResponse.json({ role: null }, { status: 401 });
  }

  const role = await getAdminRole(decoded.id);
  return NextResponse.json({ role });
}
