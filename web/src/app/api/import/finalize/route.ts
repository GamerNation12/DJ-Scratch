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

    const { jobId } = await req.json();

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const sql = postgres(process.env.DATABASE_URL || "");

    const [job] = await sql`SELECT user_id, total_chunks FROM import_jobs WHERE id = ${jobId}`;
    if (!job || job.user_id !== decoded.id) {
      return NextResponse.json({ error: "Job not found or unauthorized" }, { status: 404 });
    }

    const [{ count }] = await sql`SELECT count(*) FROM import_chunks WHERE job_id = ${jobId}`;
    if (parseInt(count, 10) !== job.total_chunks) {
      return NextResponse.json({ error: "Missing chunks" }, { status: 400 });
    }

    await sql`
      UPDATE import_jobs SET status = 'ready' WHERE id = ${jobId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Finalize upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
