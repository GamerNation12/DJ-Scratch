import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source');
  let state = '';
  if (source === 'mobile') state = '&state=mobile';

  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = encodeURIComponent(`${'https://the-goats-dj.vercel.app'}/api/auth/callback`);
  const scope = encodeURIComponent('identify guilds email');
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}${state}`;
  return NextResponse.redirect(url);
}
