import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams, protocol, host } = new URL(req.url);
  const source = searchParams.get('source');
  const queryState = searchParams.get('state');
  let state = '';
  
  if (source === 'mobile' || queryState === 'mobile') state = '&state=mobile';
  if (source === 'desktop' || queryState === 'desktop') state = '&state=desktop';

  const clientId = process.env.DISCORD_CLIENT_ID;
  const baseUrl = host.includes('localhost') ? `http://${host}` : `https://${host}`;
  const redirectUri = encodeURIComponent(`${baseUrl}/api/auth/callback`);
  const scope = encodeURIComponent('identify guilds email');
  const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}${state}`;
  return NextResponse.redirect(url);
}
