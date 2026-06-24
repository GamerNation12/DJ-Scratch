import { NextResponse } from 'next/server';

// Simulated database response for the mobile app companion screen
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      topArtists: [
        { name: 'Travis Scott', plays: 4520 },
        { name: 'The Weeknd', plays: 3100 },
        { name: 'Drake', plays: 2950 }
      ]
    }
  });
}
