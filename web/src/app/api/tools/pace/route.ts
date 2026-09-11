import { NextResponse } from "next/server";

const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "eee299142ac5fe73e5eb5dcd1c29bcae";

// Web equivalent of the bot's /pace + /milestone: total plays, daily rate,
// next milestone and ETA for any Last.fm username (no login needed).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user = (searchParams.get("user") || "").trim();
  const goalParam = parseInt(searchParams.get("goal") || "", 10);
  const goal = Number.isFinite(goalParam) && goalParam > 0 ? goalParam : null;

  if (!user) {
    return NextResponse.json({ error: "Missing ?user= (Last.fm username)" }, { status: 400 });
  }

  try {
    const [infoRes, recentRes] = await Promise.all([
      fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${encodeURIComponent(user)}&api_key=${LASTFM_API_KEY}&format=json`),
      fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(user)}&api_key=${LASTFM_API_KEY}&format=json&limit=200&page=1`),
    ]);

    const info = await infoRes.json();
    if (info.error || !info.user) {
      return NextResponse.json({ error: "Last.fm user not found." }, { status: 404 });
    }
    const total = parseInt(info.user.playcount || "0", 10);

    // Daily rate from the last ~200 scrobbles' time span.
    let dailyRate = 10;
    try {
      const recent = await recentRes.json();
      let tracks = recent?.recenttracks?.track || [];
      if (!Array.isArray(tracks)) tracks = [tracks];
      const uts = tracks
        .filter((t: any) => t.date?.uts)
        .map((t: any) => parseInt(t.date.uts, 10))
        .filter((n: number) => Number.isFinite(n));
      if (uts.length >= 2) {
        const spanDays = Math.max(1, (Math.max(...uts) - Math.min(...uts)) / 86400);
        dailyRate = Math.max(0.5, uts.length / spanDays);
      }
    } catch { /* keep default rate */ }

    const nextMilestone = total < 10 ? 10 : Math.pow(10, Math.ceil(Math.log10(total + 1)));
    const prevMilestone = nextMilestone / 10;

    const etaFor = (target: number) => {
      if (target <= total) return { reached: true as const, date: null as string | null, days: 0 };
      const days = (target - total) / dailyRate;
      const date = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      return { reached: false as const, date, days: Math.round(days) };
    };

    return NextResponse.json({
      success: true,
      user: info.user.name,
      total,
      dailyRate: Math.round(dailyRate * 10) / 10,
      prevMilestone,
      nextMilestone,
      next: etaFor(nextMilestone),
      ...(goal ? { goal, goalEta: etaFor(goal) } : {}),
    });
  } catch (error) {
    console.error("Pace error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
