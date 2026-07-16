import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  
  // Discord Activities always launch with frame_id in the URL
  if (url.searchParams.has('frame_id') || url.searchParams.has('instance_id')) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-discord-activity', 'true');

    // If Discord hits the root URL, rewrite it to /activity/dm
    if (url.pathname === '/') {
      const newUrl = new URL('/activity/dm', request.url);
      
      // Preserve search params
      url.searchParams.forEach((value, key) => {
        newUrl.searchParams.set(key, value);
      });
      
      return NextResponse.rewrite(newUrl, {
        request: {
          headers: requestHeaders,
        }
      });
    }
    
    // For all other activity requests, just inject the header
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  // Match all request paths except for static files
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
