import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import { getAdminRole } from "@/lib/admin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    const user = token ? await verifyToken(token) : null;
    const role = user ? await getAdminRole((user as any)?.id) : null;
    if (!role || (role !== 'owner' && role !== 'admin')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const disabledCommands = await sql`SELECT command_name, reason, disabled_at, disabled_by FROM disabled_commands ORDER BY disabled_at DESC`;
    return NextResponse.json(disabledCommands);
  } catch (error) {
    console.error("Error fetching disabled commands:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    const user = token ? await verifyToken(token) : null;
    const role = user ? await getAdminRole((user as any)?.id) : null;
    if (!role || (role !== 'owner' && role !== 'admin')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { command_name, reason } = await req.json();
    if (!command_name || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    
    const disabledBy = (user as any).id;

    await sql`
      INSERT INTO disabled_commands (command_name, reason, disabled_by) 
      VALUES (${command_name}, ${reason}, ${disabledBy})
      ON CONFLICT (command_name) DO UPDATE SET 
      reason = EXCLUDED.reason, 
      disabled_at = CURRENT_TIMESTAMP, 
      disabled_by = EXCLUDED.disabled_by
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error locking command:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    const user = token ? await verifyToken(token) : null;
    const role = user ? await getAdminRole((user as any)?.id) : null;
    if (!role || (role !== 'owner' && role !== 'admin')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const command_name = searchParams.get('command');
    
    if (!command_name) {
      return NextResponse.json({ error: "Missing command name" }, { status: 400 });
    }

    await sql`DELETE FROM disabled_commands WHERE command_name = ${command_name}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unlocking command:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
