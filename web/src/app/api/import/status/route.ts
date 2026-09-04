import { NextResponse } from "next/server";
import { getDisabledCommandReason } from "@/lib/commandLock";

// Public: lock state isn't secret. Used by the import tab to grey out
// uploads when the bot owner has locked imports (storage protection).
export async function GET() {
  try {
    const reason = await getDisabledCommandReason("import");
    return NextResponse.json({ locked: reason !== null, reason });
  } catch (error) {
    console.error("Import status error:", error);
    return NextResponse.json({ locked: false, reason: null });
  }
}
