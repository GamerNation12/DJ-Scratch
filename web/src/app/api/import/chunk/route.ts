import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import { getDisabledCommandReason } from "@/lib/commandLock";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const lockReason = await getDisabledCommandReason("import");
    if (lockReason) {
      return NextResponse.json({ error: `Imports are currently disabled. ${lockReason}` }, { status: 403 });
    }

    const formData = await req.formData();
    const jobId = formData.get("jobId") as string;
    const chunkIndexStr = formData.get("chunkIndex") as string;
    const chunkIndex = parseInt(chunkIndexStr, 10);
    const fileBlob = formData.get("chunk") as Blob;

    if (!jobId || !Number.isInteger(chunkIndex) || !fileBlob) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (fileBlob.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "Chunk is too large" }, { status: 413 });
    }

    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const userId = String((decoded as any).id);
    const [job] = await sql`SELECT user_id, total_chunks FROM import_jobs WHERE id = ${jobId}`;
    if (!job || job.user_id !== userId) {
      return NextResponse.json({ error: "Job not found or unauthorized" }, { status: 404 });
    }
    if (chunkIndex < 0 || chunkIndex >= job.total_chunks) {
      return NextResponse.json({ error: "Invalid chunk index" }, { status: 400 });
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
