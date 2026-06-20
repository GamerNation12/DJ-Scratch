import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import { Pool } from "pg";

const ADMIN_ID = "759433582107426816";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;
  const session = user ? { user } : null;
  if (!session || (session.user as any)?.id !== ADMIN_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const { status, admin_feedback } = await req.json();
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const result = await pool.query(
      "UPDATE suggestions SET status = $1, admin_feedback = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *",
      [status, admin_feedback, id]
    );
    await pool.end();

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }

    const suggestion = result.rows[0];

    // Send DM to the user who made the suggestion
    const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
    if (DISCORD_TOKEN && suggestion.user_id) {
      try {
        const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
          method: "POST",
          headers: {
            "Authorization": `Bot ${DISCORD_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ recipient_id: suggestion.user_id })
        });
        const dmData = await dmRes.json();
        
        if (dmData.id) {
          
          let color = 16766720; // Yellow for Pending
          let statusEmoji = "🟡";
          if (status === "approved") { color = 5763719; statusEmoji = "🟢"; } // Green
          else if (status === "denied") { color = 15548997; statusEmoji = "🔴"; } // Red
          else if (status === "completed") { color = 5793266; statusEmoji = "🚀"; } // Blurple

          await fetch(`https://discord.com/api/v10/channels/${dmData.id}/messages`, {
            method: "POST",
            headers: {
              "Authorization": `Bot ${DISCORD_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              embeds: [{
                title: `${statusEmoji} Suggestion Update: ${suggestion.title}`,
                description: `Your suggestion has been marked as **${status.toUpperCase()}**.\n\n**Your Idea:**\n${suggestion.description}`,
                color: color,
                fields: suggestion.admin_feedback ? [
                  {
                    name: "Developer Reply",
                    value: suggestion.admin_feedback
                  }
                ] : [],
                footer: {
                  text: "The Goats DJ Feedback System"
                },
                timestamp: new Date().toISOString()
              }]
            })
          });
        }
      } catch (err) {
        console.error("Failed to DM user:", err);
      }
    }

    return NextResponse.json(suggestion);
  } catch (err) {
    console.error("Failed to update suggestion:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
