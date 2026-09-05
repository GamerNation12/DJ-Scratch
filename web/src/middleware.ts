import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CORS_METHODS = 'GET,OPTIONS,PATCH,DELETE,POST,PUT';
const CORS_HEADERS =
  'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization';

function withCors(res: NextResponse, origin: string | null) {
  // Echo the caller's origin (desktop app runs at app://-, Discord
  // Activities from discordsays.com, both custom domains, localhost).
  // Auth still comes from JWTs, so this opens no data — it just stops
  // browsers from blocking legit callers. Single source of CORS truth:
  // no route or config file may set its own Allow-Origin.
  if (origin) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Vary', 'Origin');
  }
  return res;
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const origin = request.headers.get('origin');

  // Preflight for API routes.
  if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
    const res = new NextResponse(null, { status: 204 });
    res.headers.set('Access-Control-Allow-Methods', CORS_METHODS);
    res.headers.set('Access-Control-Allow-Headers', CORS_HEADERS);
    return withCors(res, origin);
  }

  // Discord Activities always launch with frame_id in the URL
  if (url.searchParams.has('frame_id') || url.searchParams.has('instance_id')) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-discord-activity', 'true');

    const res = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    return withCors(res, origin);
  }

  const res = NextResponse.next();
  if (url.pathname.startsWith('/api/')) {
    return withCors(res, origin);
  }
  return res;
}

export const config = {
  // Match all request paths except for static files
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
