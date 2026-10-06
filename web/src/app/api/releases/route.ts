import { NextResponse } from "next/server";

// Server-side proxy for GitHub releases. Unauthenticated api.github.com
// calls are limited to 60/hr per IP, so client-side fetching 403s under
// any real traffic. This caches hourly (one upstream call per hour) and
// optionally uses GITHUB_TOKEN (5000/hr) when set.
export const revalidate = 3600;
export const maxDuration = 15;

const UPSTREAM = "https://api.github.com/repos/GamerNation12/DJ-Scratch/releases";

export async function GET() {
  try {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(UPSTREAM, {
      headers,
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 403 || res.status === 429) {
      return NextResponse.json({ error: "rate_limited" }, { status: 503 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: "upstream_error" }, { status: 502 });
    }
    const data = await res.json().catch(() => null);
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch {
    return NextResponse.json({ error: "upstream_timeout" }, { status: 503 });
  }
}
