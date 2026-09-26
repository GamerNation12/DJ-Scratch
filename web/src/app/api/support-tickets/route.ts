import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const ADMIN_ID = "759433582107426816";
const TOPICS = ["General help", "Bug report", "Account / login", "Privacy / data", "Other"] as const;

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(200) NOT NULL,
      topic VARCHAR(40) NOT NULL DEFAULT 'General help',
      message TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

// Guest support tickets: no Discord login required. Stored for the record
// and DM'd to the owner (same pattern as web suggestions) so nothing waits
// on someone checking a dashboard.
export async function POST(req: Request) {
  try {
    await ensureTable();
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim().slice(0, 120);
    const email = String(body?.email || "").trim().slice(0, 200);
    const topic = TOPICS.includes(body?.topic) ? body.topic : "General help";
    const message = String(body?.message || "").trim().slice(0, 3000);
    // Honeypot: bots fill it, humans never see it.
    if (body?.website) {
      return NextResponse.json({ success: true });
    }
    if (!name || !message) {
      return NextResponse.json({ error: "Name and message are required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "That email doesn't look valid." }, { status: 400 });
    }

    const [inserted] = await sql`
      INSERT INTO support_tickets (name, email, topic, message)
      VALUES (${name}, ${email}, ${topic}, ${message})
      RETURNING id
    `;

    const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
    if (DISCORD_TOKEN) {
      try {
        const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
          method: "POST",
          headers: {
            Authorization: `Bot ${DISCORD_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ recipient_id: ADMIN_ID }),
        });
        const dmData = await dmRes.json();
        if (dmData.id) {
          await fetch(`https://discord.com/api/v10/channels/${dmData.id}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bot ${DISCORD_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              embeds: [{
                title: `🎧 New Support Ticket #${(inserted as any)?.id ?? "?"}: ${topic}`,
                description: message.slice(0, 1800),
                color: 5814783,
                fields: [
                  { name: "From", value: name, inline: true },
                  { name: "Email", value: email, inline: true },
                ],
                footer: { text: "Reply by email — sender has no Discord" },
                timestamp: new Date().toISOString(),
              }],
            }),
          });
        }
      } catch (err) {
        console.error("Failed to DM owner about ticket:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Support ticket failed:", err);
    return NextResponse.json({ error: "Could not send ticket. Please try again later." }, { status: 500 });
  }
}
