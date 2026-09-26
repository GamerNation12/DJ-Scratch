import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import { getAdminRole } from "@/lib/admin";

export const dynamic = "force-dynamic";

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS support_threads (
      id TEXT PRIMARY KEY,
      secret TEXT NOT NULL,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(200) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      last_visitor_seen TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS support_messages (
      id SERIAL PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
      sender VARCHAR(10) NOT NULL,
      body TEXT NOT NULL,
      email_sent BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_support_messages_thread ON support_messages (thread_id, id)`;
}

async function adminUser(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  if (!token) return null;
  const user = await verifyToken(token).catch(() => null);
  if (!user || !(user as any).id) return null;
  const role = await getAdminRole((user as any).id);
  if (!role) return null;
  return user as any;
}

async function sendReplyEmail(to: string, name: string, reply: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log("RESEND_API_KEY not set — skipping reply email.");
    return false;
  }
  const from = process.env.RESEND_FROM || "DJ Scratch Support <support@dj-scratch.vercel.app>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "DJ Scratch support replied to your chat",
        text:
          `Hi ${name},\n\nSupport replied to your chat on DJ Scratch:\n\n"${reply}"\n\n` +
          `Open https://dj-scratch.vercel.app/support to continue the conversation.\n\n— DJ Scratch`,
      }),
    });
    if (!res.ok) {
      console.error("Resend failed:", await res.text().catch(() => res.status));
      return false;
    }
    return true;
  } catch (e) {
    console.error("Resend error:", e);
    return false;
  }
}

// Owner inbox (admin JWT): threads with preview + unread counts.
export async function GET(req: Request) {
  const user = await adminUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureTables();
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get("threadId");
    if (threadId) {
      const msgs = await sql`
        SELECT id, sender, body, email_sent, created_at FROM support_messages
        WHERE thread_id = ${threadId} ORDER BY id ASC LIMIT 200
      `;
      return NextResponse.json({ messages: msgs });
    }
    const threads = await sql`
      SELECT t.id, t.name, t.email, t.status, t.updated_at,
        (SELECT body FROM support_messages m WHERE m.thread_id = t.id ORDER BY id DESC LIMIT 1) AS preview,
        (SELECT COUNT(*)::int FROM support_messages m WHERE m.thread_id = t.id AND m.sender = 'visitor') AS visitor_msgs
      FROM support_threads t ORDER BY t.updated_at DESC LIMIT 100
    `;
    return NextResponse.json({ threads });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTables();
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    // --- Visitor: start a thread ---
    if (action === "start") {
      const name = String(body?.name || "").trim().slice(0, 120);
      const email = String(body?.email || "").trim().slice(0, 200);
      const first = String(body?.message || "").trim().slice(0, 3000);
      if (body?.website) return NextResponse.json({ threadId: null, secret: null }); // honeypot
      if (!name) return NextResponse.json({ error: "Name required." }, { status: 400 });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "Valid email required (for replies)." }, { status: 400 });
      }
      const id = randomUUID().replace(/-/g, "").slice(0, 16);
      const secret = randomUUID().replace(/-/g, "");
      await sql`INSERT INTO support_threads (id, secret, name, email, last_visitor_seen)
                VALUES (${id}, ${secret}, ${name}, ${email}, CURRENT_TIMESTAMP)`;
      if (first) {
        await sql`INSERT INTO support_messages (thread_id, sender, body) VALUES (${id}, 'visitor', ${first})`;
      }
      return NextResponse.json({ threadId: id, secret });
    }

    // --- Visitor: poll (also marks them present) + send ---
    if (action === "poll" || action === "send") {
      const threadId = String(body?.threadId || "");
      const secret = String(body?.secret || "");
      if (!threadId || !secret) return NextResponse.json({ error: "Bad thread." }, { status: 400 });
      const rows = await sql`SELECT id, status FROM support_threads WHERE id = ${threadId} AND secret = ${secret}`;
      if (rows.length === 0) return NextResponse.json({ error: "Thread not found." }, { status: 404 });
      if (action === "send") {
        const text = String(body?.body || "").trim().slice(0, 3000);
        if (!text) return NextResponse.json({ error: "Empty message." }, { status: 400 });
        if (rows[0].status === "closed") {
          return NextResponse.json({ error: "This chat is closed — start a new one!" }, { status: 400 });
        }
        await sql`INSERT INTO support_messages (thread_id, sender, body) VALUES (${threadId}, 'visitor', ${text})`;
        await sql`UPDATE support_threads SET updated_at = CURRENT_TIMESTAMP, last_visitor_seen = CURRENT_TIMESTAMP WHERE id = ${threadId}`;
      } else {
        await sql`UPDATE support_threads SET last_visitor_seen = CURRENT_TIMESTAMP WHERE id = ${threadId}`;
      }
      const msgs = await sql`
        SELECT id, sender, body, created_at FROM support_messages
        WHERE thread_id = ${threadId} ORDER BY id ASC LIMIT 200
      `;
      return NextResponse.json({ messages: msgs, status: rows[0].status });
    }

    // --- Owner: reply (emails visitor if they're away) ---
    if (action === "reply") {
      const user = await adminUser(req);
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const threadId = String(body?.threadId || "");
      const text = String(body?.body || "").trim().slice(0, 3000);
      if (!threadId || !text) return NextResponse.json({ error: "Missing thread/message." }, { status: 400 });
      const rows = await sql`SELECT id, name, email, last_visitor_seen FROM support_threads WHERE id = ${threadId}`;
      if (rows.length === 0) return NextResponse.json({ error: "Thread not found." }, { status: 404 });
      const [ins] = await sql`
        INSERT INTO support_messages (thread_id, sender, body) VALUES (${threadId}, 'owner', ${text}) RETURNING id
      `;
      await sql`UPDATE support_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ${threadId}`;
      // Away = never seen or silent 60s+ → email them so they know.
      let emailed = false;
      try {
        const seen = (rows[0] as any).last_visitor_seen
          ? new Date((rows[0] as any).last_visitor_seen).getTime()
          : 0;
        if (Date.now() - seen > 60 * 1000) {
          emailed = await sendReplyEmail(
            String((rows[0] as any).email),
            String((rows[0] as any).name || "there"),
            text.slice(0, 1000)
          );
          if (emailed) {
            await sql`UPDATE support_messages SET email_sent = TRUE WHERE id = ${(ins as any).id}`;
          }
        }
      } catch (e) {
        console.error("Reply email check failed:", e);
      }
      return NextResponse.json({ success: true, emailed });
    }

    // --- Owner or visitor: close ---
    if (action === "close") {
      const threadId = String(body?.threadId || "");
      const secret = String(body?.secret || "");
      const user = await adminUser(req);
      if (user) {
        await sql`UPDATE support_threads SET status = 'closed' WHERE id = ${threadId}`;
        return NextResponse.json({ success: true });
      }
      if (!threadId || !secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const rows = await sql`SELECT id FROM support_threads WHERE id = ${threadId} AND secret = ${secret}`;
      if (rows.length === 0) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      await sql`UPDATE support_threads SET status = 'closed' WHERE id = ${threadId}`;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Bad action." }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
