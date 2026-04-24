import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { environmentId } = await req.json();

    const env = await prisma.environment.findFirst({
      where: { id: environmentId, series: { userId: user.id } },
      include: { series: true },
    });

    if (!env) return NextResponse.json({ error: "Environment not found" }, { status: 404 });

    const prompt = `${env.series.visualStyle} style, establishing shot, cinematic wide angle.
Location: ${env.name}.
Description: ${env.description}.
Lighting: ${env.lighting || "natural daylight"}.
Mood: ${env.mood || "neutral"}.
No characters, empty scene, high quality background art, professional animation background.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
    });

    const imageUrl = (response.data ?? [])[0]?.url;
    if (!imageUrl) throw new Error("No image generated");

    await prisma.environment.update({
      where: { id: environmentId },
      data: { previewImageUrl: imageUrl } as never,
    });

    return NextResponse.json({ imageUrl, environmentId });
  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
