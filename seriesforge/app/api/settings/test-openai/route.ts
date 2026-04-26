import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getCurrentUser } from "@/lib/auth";
import { getApiKey } from "@/lib/server/apiKeyOverride";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = getApiKey(req, "OPENAI_API_KEY");
    if (!apiKey) return NextResponse.json({ ok: false, error: "No API key configured" });

    const openai = new OpenAI({ apiKey });
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say OK" }],
      max_tokens: 5,
    });

    if (res.choices[0].message.content) {
      return NextResponse.json({ ok: true, model: "gpt-4o-mini" });
    }
    return NextResponse.json({ ok: false, error: "No response" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg });
  }
}
