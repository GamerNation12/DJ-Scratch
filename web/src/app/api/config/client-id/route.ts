import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ clientId: process.env.DISCORD_CLIENT_ID });
}
