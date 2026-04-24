import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sceneId } = await req.json();

    const scene = await prisma.scene.findFirst({
      where: { id: sceneId, episode: { series: { userId: user.id } } },
      include: { episode: { include: { series: true } } },
    });

    if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

    const prompt = scene.imagePrompt ||
      `${scene.episode.series.visualStyle} cinematic keyframe, ${scene.location || "outdoor scene"}, ${scene.action || "dramatic moment"}, ${scene.emotion || "neutral"}, high quality animated still.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: scene.episode.format === "9:16" ? "1024x1792" : "1792x1024",
      quality: "standard",
    });

    const imageUrl = (response.data ?? [])[0]?.url;
    if (!imageUrl) throw new Error("No image generated");

    await prisma.scene.update({
      where: { id: sceneId },
      data: { imageUrl },
    });

    return NextResponse.json({ imageUrl, sceneId });
  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
