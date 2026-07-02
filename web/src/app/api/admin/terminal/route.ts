import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const pteroUrl = process.env.PTERO_URL?.replace(/\/$/, "");
    const pteroKey = process.env.PTERO_API_KEY;

    if (!pteroUrl || !pteroKey) {
      return NextResponse.json(
        { error: 'PTERO_URL or PTERO_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Use the known short ID for the DJ Scratch bot server
    const serverId = '5be081c1';
    const response = await fetch(`${pteroUrl}/api/client/servers/${serverId}/websocket`, {
      headers: {
        'Authorization': `Bearer ${pteroKey}`,
        'Accept': 'application/vnd.pterodactyl.v1+json',
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Failed to fetch Pterodactyl websocket token:', errText);
      return NextResponse.json(
        { error: 'Failed to authenticate with Pterodactyl server' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // The response contains data.data.token and data.data.socket
    return NextResponse.json({
      token: data.data.token,
      socket: data.data.socket
    });

  } catch (error: any) {
    console.error('Terminal websocket error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
