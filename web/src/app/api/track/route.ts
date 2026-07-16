import { NextResponse } from "next/server";

const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "eee299142ac5fe73e5eb5dcd1c29bcae";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get("track");
  const artist = searchParams.get("artist");
  const username = searchParams.get("username");

  if (!track || !artist) {
    return NextResponse.json({ error: "Missing track or artist parameter." }, { status: 400 });
  }

  try {
    let url = `http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${LASTFM_API_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&format=json`;
    if (username) {
      url += `&username=${encodeURIComponent(username)}`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: `Last.fm API returned ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: data.message }, { status: 400 });
    }

    return NextResponse.json(data.track);
  } catch (error) {
    console.error("Track info error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
