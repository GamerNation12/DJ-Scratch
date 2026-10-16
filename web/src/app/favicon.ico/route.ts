import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Browsers request /favicon.ico unconditionally; without this route Next
// answers 500. Serve the app icon bytes instead of redirecting.
export async function GET() {
  try {
    const buf = await readFile(join(process.cwd(), "src", "app", "icon.png"));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
