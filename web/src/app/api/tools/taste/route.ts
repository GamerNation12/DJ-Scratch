import { NextResponse } from "next/server";
import { tasteMatch } from "@/lib/taste";

const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "eee299142ac5fe73e5eb5dcd1c29bcae";

// Web equivalent of the bot's /taste: compatibility between any two Last.fm
// usernames (top artists compared with the shared tasteMatch scorer).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const a = (searchParams.get("a") || "").trim();
  const b = (searchParams.get("b") || "").trim();

  if (!a || !b) {
    return NextResponse.json({ error: "Missing ?a= and ?b= (Last.fm usernames)" }, { status: 400 });
  }

  try {
    const fetchTop = async (user: string) => {
      const res = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${encodeURIComponent(user)}&api_key=${LASTFM_API_KEY}&format=json&limit=50&period=overall`
      );
      const data = await res.json();
      if (data.error || !data.topartists?.artist) return null;
      const arr = Array.isArray(data.topartists.artist) ? data.topartists.artist : [data.topartists.artist];
      return arr.map((x: any) => ({ name: x.name, playcount: parseInt(x.playcount || "0", 10) }));
    };

    const [topA, topB] = await Promise.all([fetchTop(a), fetchTop(b)]);
    if (!topA) return NextResponse.json({ error: `Last.fm user "${a}" not found.` }, { status: 404 });
    if (!topB) return NextResponse.json({ error: `Last.fm user "${b}" not found.` }, { status: 404 });

    const result = tasteMatch(topA, topB);
    return NextResponse.json({ success: true, a, b, ...result });
  } catch (error) {
    console.error("Taste error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
