import { NextResponse } from 'next/server';

// Simulated database response for the mobile app admin screen
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      botStatus: 'Online',
      serverCount: 1245,
      dbLatency: '12ms'
    }
  });
}
