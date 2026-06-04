import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getDb } from "@/lib/db";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Base64 audio can be large
    },
  },
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any)?.id !== "759433582107426816") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { channelId, audioBase64 } = await req.json();

    if (!channelId || !audioBase64) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sql = getDb();
    
    // Insert into Postgres
    await sql(
      `INSERT INTO voice_transmissions (channel_id, audio_base64, status) VALUES ($1, $2, 'PENDING')`,
      [channelId, audioBase64]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Internal Server Error uploading voice transmission:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
