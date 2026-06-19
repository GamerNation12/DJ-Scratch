import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { code } = await req.json();

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET in environment variables.');
      return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
    }

    const response = await fetch(`https://discord.com/api/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Discord API error during token exchange:', data);
      return NextResponse.json({ error: 'Failed to fetch access token', details: data }, { status: response.status });
    }

    return NextResponse.json({ access_token: data.access_token });
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
