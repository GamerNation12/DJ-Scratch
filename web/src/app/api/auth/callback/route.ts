import { NextResponse } from 'next/server';
import { signToken } from '@/lib/jwt';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=NoCode', request.url));
  }

  const clientId = process.env.DISCORD_CLIENT_ID!;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET!;
  const redirectUri = `${'https://the-goats-dj.vercel.app'}/api/auth/callback`;

  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    return NextResponse.redirect(new URL('/?error=TokenFailed', request.url));
  }

  const userResponse = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const userData = await userResponse.json();

  const jwt = await signToken({
    id: userData.id,
    name: userData.username,
    email: userData.email,
    image: `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`,
  });

  return NextResponse.redirect(new URL(`/dashboard#token=${jwt}`, request.url));
}
