import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    const user = token ? await verifyToken(token) : null;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const incomingData = await req.formData();
    const file = incomingData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Proxy the upload to uguu.se to avoid CORS and local hosting
    const formData = new FormData();
    formData.append("files[]", file);

    const res = await fetch("https://uguu.se/upload.php", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    
    if (data.success && data.files && data.files.length > 0) {
      return NextResponse.json({ url: data.files[0].url, success: true });
    } else {
      return NextResponse.json({ error: "External upload failed" }, { status: 500 });
    }

  } catch (error) {
    console.error("External upload error:", error);
    return NextResponse.json({ error: "Failed to upload file to external host" }, { status: 500 });
  }
}
