import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/auth/callback`);
  const scope = encodeURIComponent('identify guilds email');
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  return NextResponse.redirect(url);
}
