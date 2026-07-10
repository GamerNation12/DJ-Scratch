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

    // Proxy the upload to freeimage.host for permanent hotlinkable images
    const formData = new FormData();
    formData.append("source", file);
    formData.append("key", "6d207e02198a847aa98d0a2a901485a5");

    const res = await fetch("https://freeimage.host/api/1/upload", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    
    if (data.status_code === 200 && data.image && data.image.url) {
      return NextResponse.json({ url: data.image.url, success: true });
    } else {
      return NextResponse.json({ error: "External upload failed" }, { status: 500 });
    }

  } catch (error) {
    console.error("External upload error:", error);
    return NextResponse.json({ error: "Failed to upload file to external host" }, { status: 500 });
  }
}
