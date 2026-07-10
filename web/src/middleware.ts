import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Discord Activities always append a frame_id or instance_id query parameter when loading the iframe.
  // We can use this to detect if the request is coming from a Discord Activity.
  const hasDiscordParams = request.nextUrl.searchParams.has('frame_id') || request.nextUrl.searchParams.has('instance_id');
  
  // If they hit the root URL inside a Discord Activity, route them directly to the DM UI
  if (hasDiscordParams && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/activity/dm'
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/',
}
