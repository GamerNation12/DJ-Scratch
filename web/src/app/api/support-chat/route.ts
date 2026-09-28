import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sql } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import { getAdminRole } from "@/lib/admin";
import { sendDiscordDM } from "@/lib/discord";

export const dynamic = "force-dynamic";

const ADMIN_ID = "759433582107426816";
const INBOX_URL = "https://dj-scratch.is-a-fullstack.dev/admin/support";
const INBOX_BUTTON = [
  {
    type: 1,
    components: [{ type: 2, style: 5, label: "Open support inbox", url: INBOX_URL }],
  },
];

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
  const subject = "DJ Scratch support replied to your chat";
  const text =
    `Hi ${name},\n\nSupport replied to your chat on DJ Scratch:\n\n"${reply}"\n\n` +
    `Open https://dj-scratch.is-a-fullstack.dev/support to continue the conversation.\n\n— DJ Scratch`;

  // Mailjet (needs MAILJET_API_KEY + MAILJET_SECRET_KEY, verified sender domain).
  // MAILJET_FROM may be "Name <email>" or a bare address.
  if (process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY) {
    try {
      const raw = process.env.MAILJET_FROM || "DJ Scratch Support <support@dj-scratch.is-a-fullstack.dev>";
      const m = raw.match(/^(.*)<([^<>]+)>\s*$/);
      const fromName = (m ? m[1] : "DJ Scratch Support").trim() || "DJ Scratch Support";
      const fromEmail = (m ? m[2] : raw).trim();
      const creds = Buffer.from(`${process.env.MAILJET_API_KEY}:${process.env.MAILJET_SECRET_KEY}`).toString("base64");
      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const html =
        `<div style="background:#0e0618;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">` +
        `<div style="max-width:560px;margin:0 auto;background:#1a0b2e;border:1px solid #ffffff1a;border-radius:16px;overflow:hidden;">` +
        `<div style="background:linear-gradient(135deg,#7c3aed,#d946ef);padding:24px;text-align:center;">` +
        `<img src="https://dj-scratch.is-a-fullstack.dev/logo.png?v=2" alt="DJ Scratch" width="64" height="64" style="border-radius:16px;display:block;margin:0 auto 8px;" />` +
        `<div style="color:#fff;font-size:20px;font-weight:bold;">DJ Scratch Support</div></div>` +
        `<div style="padding:28px;color:#e4e4e7;font-size:15px;line-height:1.6;">` +
        `<p style="margin:0 0 12px;">Hi ${esc(name)},</p>` +
        `<p style="margin:0 0 12px;color:#a1a1aa;">Support replied to your chat:</p>` +
        `<div style="background:#00000066;border-left:3px solid #d946ef;border-radius:0 12px 12px 0;padding:14px 16px;margin:0 0 20px;color:#fff;">${esc(reply).replace(/\n/g, "<br />")}</div>` +
        `<a href="https://dj-scratch.is-a-fullstack.dev/support" style="display:inline-block;background:#fff;color:#09090b;font-weight:bold;font-size:14px;padding:12px 28px;border-radius:12px;text-decoration:none;">Continue the conversation</a>` +
        `</div><div style="padding:16px;text-align:center;color:#71717a;font-size:12px;">— DJ Scratch</div>` +
        `</div></div>`;
      const res = await fetch("https://api.mailjet.com/v3.1/send", {
        method: "POST",
        headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          Messages: [
            {
              From: { Email: fromEmail, Name: fromName },
              To: [{ Email: to, Name: name }],
              Subject: subject,
              TextPart: text,
              HTMLPart: html,
            },
          ],
        }),
      });
      if (!res.ok) {
        console.error("Mailjet failed:", await res.text().catch(() => res.status));
      } else {
        return true;
      }
    } catch (e) {
      console.error("Mailjet error:", e);
    }
  }

  console.log("No mail provider configured (MAILJET_API_KEY + MAILJET_SECRET_KEY) — skipping reply email.");
  return false;
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
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: "That email doesn't look valid." }, { status: 400 });
      }
      const id = randomUUID().replace(/-/g, "").slice(0, 16);
      const secret = randomUUID().replace(/-/g, "");
      await sql`INSERT INTO support_threads (id, secret, name, email, last_visitor_seen)
                VALUES (${id}, ${secret}, ${name}, ${email}, CURRENT_TIMESTAMP)`;
      if (first) {
        await sql`INSERT INTO support_messages (thread_id, sender, body) VALUES (${id}, 'visitor', ${first})`;
      }
      // Ping the owner on Discord so the chat doesn't sit unseen.
      void sendDiscordDM(
        ADMIN_ID,
        "",
        INBOX_BUTTON,
        [
          {
            title: `💬 New support chat from ${name}`,
            description: (first || "(no message yet)").slice(0, 1800),
            color: 5814783,
            fields: [{ name: "Email", value: email, inline: true }],
          },
        ]
      );
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
        const who = await sql`SELECT name, email FROM support_threads WHERE id = ${threadId}`;
        const wname = String((who[0] as any)?.name || "Guest");
        void sendDiscordDM(
          ADMIN_ID,
          "",
          INBOX_BUTTON,
          [
            {
              title: `💬 Reply in support chat (${wname})`,
              description: text.slice(0, 1800),
              color: 5814783,
            },
          ]
        );
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
      // Away = never seen or silent 60s+ → email them (if they left an
      // address) so they know.
      let emailed = false;
      try {
        const dest = String((rows[0] as any).email || "");
        const seen = (rows[0] as any).last_visitor_seen
          ? new Date((rows[0] as any).last_visitor_seen).getTime()
          : 0;
        if (dest && Date.now() - seen > 60 * 1000) {
          emailed = await sendReplyEmail(
            dest,
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
