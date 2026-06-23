import { NextResponse } from "next/server";
import postgres from "postgres";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const token = (await cookieStore).get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { filename, totalChunks } = await req.json();

    if (!filename || typeof totalChunks !== "number") {
      return NextResponse.json({ error: "Missing filename or totalChunks" }, { status: 400 });
    }

    const sql = postgres(process.env.DATABASE_URL || "");
    const jobId = uuidv4();

    const userId = String((decoded as any).id);
    const fileNameStr = String(filename);

    await sql`
      INSERT INTO import_jobs (id, user_id, filename, total_chunks, status)
      VALUES (${jobId}, ${userId}, ${fileNameStr}, ${totalChunks}, 'uploading')
    `;

    return NextResponse.json({ success: true, jobId });
  } catch (error) {
    console.error("Init upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
