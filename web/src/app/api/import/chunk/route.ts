import { NextResponse } from "next/server";
import postgres from "postgres";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

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

    const formData = await req.formData();
    const jobId = formData.get("jobId") as string;
    const chunkIndexStr = formData.get("chunkIndex") as string;
    const chunkIndex = parseInt(chunkIndexStr, 10);
    const fileBlob = formData.get("chunk") as Blob;

    if (!jobId || isNaN(chunkIndex) || !fileBlob) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const sql = postgres(process.env.DATABASE_URL || "");

    const userId = String((decoded as any).id);
    const [job] = await sql`SELECT user_id FROM import_jobs WHERE id = ${jobId}`;
    if (!job || job.user_id !== userId) {
      return NextResponse.json({ error: "Job not found or unauthorized" }, { status: 404 });
    }

    await sql`
      INSERT INTO import_chunks (job_id, chunk_index, data)
      VALUES (${jobId}, ${chunkIndex}, ${buffer})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Chunk upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
