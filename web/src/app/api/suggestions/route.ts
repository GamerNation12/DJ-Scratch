import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";

const ADMIN_ID = "759433582107426816";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;
  const session = user ? { user } : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any)?.id;
  const isAdmin = userId === ADMIN_ID;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    let result;
    if (isAdmin) {
      result = await pool.query("SELECT * FROM suggestions ORDER BY created_at DESC");
    } else {
      result = await pool.query("SELECT * FROM suggestions WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
    }
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch suggestions:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    await pool.end();
  }
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;
  const session = user ? { user } : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any)?.id;
  const username = session.user?.name || "Unknown";
  
  try {
    const { title, description } = await req.json();
    
    if (!title || !description) {
      return NextResponse.json({ error: "Title and description required" }, { status: 400 });
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query(
      "INSERT INTO suggestions (user_id, username, title, description) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, username, title, description]
    );
    await pool.end();

    // Send a DM to the owner via Discord API
    const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
    if (DISCORD_TOKEN) {
      try {
        const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
          method: "POST",
          headers: {
            "Authorization": `Bot ${DISCORD_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ recipient_id: ADMIN_ID })
        });
        const dmData = await dmRes.json();
        
        if (dmData.id) {
          await fetch(`https://discord.com/api/v10/channels/${dmData.id}/messages`, {
            method: "POST",
            headers: {
              "Authorization": `Bot ${DISCORD_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              embeds: [{
                title: `💡 New Web Suggestion: ${title}`,
                description: description,
                color: 16766720,
                author: {
                  name: `${username} (${userId})`
                },
                footer: {
                  text: "Sent from: Web Dashboard | Saved to Dashboard"
                },
                timestamp: new Date().toISOString()
              }],
              components: [{
                type: 1, // ActionRow
                components: [
                  { type: 2, style: 3, label: "Approve", custom_id: "sugg_approve" },
                  { type: 2, style: 4, label: "Deny", custom_id: "sugg_deny" },
                  { type: 2, style: 1, label: "Released", custom_id: "sugg_released" }
                ]
              }]
            })
          });
        }
      } catch (err) {
        console.error("Failed to DM owner:", err);
      }
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("Failed to submit suggestion:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
