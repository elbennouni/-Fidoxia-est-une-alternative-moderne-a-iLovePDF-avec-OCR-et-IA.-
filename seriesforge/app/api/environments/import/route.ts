import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function normalizeEnvironments(rawJson: unknown) {
  const prompt = `Extract all locations/environments from this JSON. Keep original language.

RAW INPUT:
${JSON.stringify(rawJson, null, 2).slice(0, 4000)}

Return ONLY valid JSON:
{
  "environments": [
    {
      "name": "Location name",
      "description": "Detailed visual description of the place",
      "lighting": "Lighting description",
      "mood": "Atmosphere and mood"
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
  return result.environments || [];
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { seriesId, rawJson } = await req.json();
    const series = await prisma.series.findFirst({ where: { id: seriesId, userId: user.id } });
    if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

    const environments = await normalizeEnvironments(rawJson);
    const created = [];

    for (const env of environments) {
      const e = await prisma.environment.create({
        data: { seriesId, name: env.name, description: env.description, lighting: env.lighting, mood: env.mood, reusable: true },
      });
      created.push(e);
    }

    return NextResponse.json({ success: true, count: created.length, environments: created });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 500 });
  }
}
