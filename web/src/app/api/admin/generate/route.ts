import { getAdminRole } from "@/lib/admin";
import { verifyToken } from "@/lib/jwt";
import { NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const user = token ? await verifyToken(token) : null;
  const session = user ? { user } : null;

  const role = session ? await getAdminRole((session.user as any)?.id) : null;
  if (!role || (role !== "owner" && role !== "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Missing message to enhance" }, { status: 400 });
    }

    // Cap raw commit text going INTO the model so huge bodies can't blow up
    // the prompt or produce a giant changelog. Keep updates SHORT — nobody
    // reads walls of text. Target: a glanceable 3-5 bullets.
    const MAX_INPUT_CHARS = 3000;
    const MAX_OUTPUT_CHARS = 450;
    const rawInput = String(message).slice(0, MAX_INPUT_CHARS);

    let apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      try {
        const envContent = fs.readFileSync(path.join(process.cwd(), '../.env'), 'utf8');
        const match = envContent.match(/GROQ_API_KEY=(.*)/);
        if (match) apiKey = match[1].trim();
      } catch (e) {
        console.error("Could not read ../.env:", e);
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 });
    }

    const systemPrompt = `You are DJ Scratch's hype update assistant.
The user will provide a list of raw GitHub commit messages. Your job is to transform them into an exciting, user-friendly, and beautifully formatted Discord update announcement.
- REWRITE the technical commit messages into fun, exciting, and easily digestible updates for Discord users. DO NOT just copy and paste the original text.
- Add personality, hype, and excitement to each point (avoid being overly corporate).
- Break down the updates into clean bullet points.
- Categorize and prefix each point with an appropriate emoji and bold tag (e.g. ✨ **New Feature:**, 🐛 **Bug Fix:**, 🔧 **Update:**, 🚀 **Improvement:**).
- Do not include any introductory or concluding sentences, just the formatted changelog points.
- HARD LIMITS (people skim, nobody reads walls of text): at most 5 bullet points, each bullet ONE short line of at most 80 characters, total output at most 450 characters. Merge or drop minor points to fit. Shorter is better — cut everything non-essential.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        // NOTE: gpt-oss is a reasoning model — its thinking counts against
        // the token budget. Too small a cap = empty reply. Keep this roomy;
        // output length is enforced by the server-side trim below, not here.
        max_tokens: 1500,
        reasoning_effort: "low",
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Raw Commit Message:\n${rawInput}` }
        ]
      })
    });

    if (!res.ok) {
      let errorData;
      try { errorData = await res.json(); } catch(e) { errorData = await res.text(); }
      console.error("Groq API Error:", errorData);
      return NextResponse.json({ error: "Groq API Failed", details: errorData }, { status: 502 });
    }

    const data = await res.json();
    let generatedText: string | undefined = data.choices?.[0]?.message?.content;

    if (!generatedText) {
      // Log the shape so Vercel logs show WHY (e.g. reasoning-only reply).
      try {
        console.error("Groq empty content, response shape:", JSON.stringify(data).slice(0, 1000));
      } catch { /* logging must never break the route */ }
      return NextResponse.json({ error: "AI returned an empty response — try again" }, { status: 500 });
    }

    // Hard-trim server-side: strip intro/outro lines the model sometimes adds,
    // then cut to MAX_OUTPUT_CHARS on a line boundary so embeds never overflow.
    generatedText = generatedText.trim();
    if (generatedText.length > MAX_OUTPUT_CHARS) {
      const cut = generatedText.slice(0, MAX_OUTPUT_CHARS);
      const lastBreak = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(". "));
      generatedText = (lastBreak > MAX_OUTPUT_CHARS * 0.5 ? cut.slice(0, lastBreak) : cut).trimEnd() + "…";
    }

    return NextResponse.json({ result: generatedText });
  } catch (error) {
    console.error("Error generating AI message:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
