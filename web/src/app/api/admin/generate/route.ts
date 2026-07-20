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
- Break down the updates into clean bullet points (one for each major change).
- Categorize and prefix each point with an appropriate emoji and bold tag (e.g. ✨ **New Feature:**, 🐛 **Bug Fix:**, 🔧 **Update:**, 🚀 **Improvement:**).
- Use an engaging, hype, but professional tone (avoid being overly corporate).
- Keep descriptions clear and easy to understand for everyday Discord users.
- Do not include any introductory or concluding sentences, just the formatted changelog points.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Raw Commit Message:\n${message}` }
        ]
      })
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error("Groq API Error:", errorData);
      return NextResponse.json({ error: "Failed to generate AI message" }, { status: res.status });
    }

    const data = await res.json();
    const generatedText = data.choices?.[0]?.message?.content;

    if (!generatedText) {
      return NextResponse.json({ error: "No text returned from AI" }, { status: 500 });
    }

    return NextResponse.json({ result: generatedText.trim() });
  } catch (error) {
    console.error("Error generating AI message:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
