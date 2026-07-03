import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await fetch("http://mango.fps.ms:20544/emojis", { cache: 'no-store' });
    if (!res.ok) throw new Error("Failed to fetch emojis from bot");
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
