import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = encodeURIComponent(`${'https://the-goats-dj.vercel.app'}/api/auth/callback`);
  const scope = encodeURIComponent('identify guilds email');
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  return NextResponse.redirect(url);
}
