import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildConsistencyPrompt } from "@/lib/agents/characterConsistencyAgent";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function normalizeCharacters(rawJson: unknown): Promise<Array<{
  name: string;
  physicalDescription: string;
  outfit: string;
  personality: string;
  voiceProfile: string;
}>> {
  const prompt = `You are a character bible analyst. The user provided a JSON with character descriptions in any format/language.

Extract ALL characters and normalize them into this exact structure.
Keep all text in the ORIGINAL language of the input.

RAW INPUT:
${JSON.stringify(rawJson, null, 2).slice(0, 6000)}

Return ONLY valid JSON:
{
  "characters": [
    {
      "name": "Character name",
      "physicalDescription": "Full physical description: age, body type, hair, eyes, skin, facial features",
      "outfit": "Complete outfit description: clothing, accessories, shoes, colors",
      "personality": "Personality traits, behavior, speech style, quirks",
      "voiceProfile": "Voice description: tone, accent, speed, energy"
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return result.characters || [];
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { seriesId, rawJson } = await req.json();
    if (!seriesId || !rawJson) return NextResponse.json({ error: "seriesId and rawJson required" }, { status: 400 });

    const series = await prisma.series.findFirst({ where: { id: seriesId, userId: user.id } });
    if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

    // Normalize with GPT-4o
    const characters = await normalizeCharacters(rawJson);

    if (!characters.length) return NextResponse.json({ error: "No characters found in JSON" }, { status: 400 });

    const created = [];
    for (const char of characters) {
      const consistencyPrompt = buildConsistencyPrompt({
        name: char.name,
        physicalDescription: char.physicalDescription,
        outfit: char.outfit,
        personality: char.personality,
      });

      const c = await prisma.character.create({
        data: {
          seriesId,
          name: char.name,
          physicalDescription: char.physicalDescription,
          outfit: char.outfit,
          personality: char.personality,
          voiceProfile: char.voiceProfile || null,
          consistencyPrompt,
        },
      });
      created.push(c);
    }

    return NextResponse.json({ success: true, count: created.length, characters: created });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 500 });
  }
}
