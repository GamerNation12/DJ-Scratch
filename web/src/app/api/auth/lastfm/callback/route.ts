import { NextResponse } from "next/server";
import { Pool } from "@neondatabase/serverless";
import crypto from "crypto";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const discordId = searchParams.get("discord_id");

  if (!token || !discordId) {
    return new NextResponse("Missing token or discord_id parameter.", { status: 400 });
  }

  const apiKey = process.env.LASTFM_API_KEY || "696438a21fc540d4cb27faa736239e75";
  const sharedSecret = process.env.LASTFM_SHARED_SECRET || "f8b8268e5067d5b927880f9d64abe5bc";

  if (!sharedSecret) {
    return new NextResponse(
      "Configuration error: LASTFM_SHARED_SECRET is not set in the environment. Please contact the bot owner.",
      { status: 500 }
    );
  }

  try {
    // Generate api_sig
    // Last.fm requires alphabetical sorting of parameters
    // Params: api_key, method, token
    const sigString = `api_key${apiKey}methodauth.getSessiontoken${token}${sharedSecret}`;
    const apiSig = crypto.createHash("md5").update(sigString, "utf8").digest("hex");

    const url = `http://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${apiKey}&token=${token}&api_sig=${apiSig}&format=json`;
    
    const res = await fetch(url);
    const data = await res.json();

    if (data.error || !data.session?.name) {
      console.error("Last.fm Auth Error:", data);
      return new NextResponse(`Last.fm Authentication Failed: ${data.message || "Unknown error"}`, { status: 400 });
    }

    const lastfmUsername = data.session.name;

    // Save to Postgres
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO user_settings (user_id, lastfm_username) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id) DO UPDATE SET lastfm_username = EXCLUDED.lastfm_username`,
      [discordId, lastfmUsername]
    );
    await pool.end();

    // Return success HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Account Linked!</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #121212;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          .container {
            background-color: #1e1e1e;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            max-width: 500px;
          }
          h1 { color: #4caf50; margin-top: 0; }
          p { font-size: 1.1em; color: #b3b3b3; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Success!</h1>
          <p>Your Last.fm account <strong>${lastfmUsername}</strong> has been successfully linked to your Discord account.</p>
          <p>You may now safely close this tab and return to Discord.</p>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html" }
    });
  } catch (error) {
    console.error("Callback Error:", error);
    return new NextResponse("Internal Server Error while linking account.", { status: 500 });
  }
}
