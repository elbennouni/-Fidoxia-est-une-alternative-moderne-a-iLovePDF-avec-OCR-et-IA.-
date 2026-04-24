import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const episode = await prisma.episode.findFirst({
      where: { id, series: { userId: user.id } },
      include: { series: true },
    });
    if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

    const scenes = await prisma.scene.findMany({
      where: { episodeId: id, imagePrompt: { not: null } },
      orderBy: { sceneNumber: "asc" },
    });

    const results = [];

    for (const scene of scenes) {
      if (!scene.imagePrompt) continue;
      try {
        const size = episode.format === "9:16" ? "1024x1792" : "1792x1024";
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: scene.imagePrompt.slice(0, 4000),
          n: 1,
          size: size as "1024x1024" | "1024x1792" | "1792x1024",
          quality: "standard",
        });
        const imageUrl = (response.data ?? [])[0]?.url;
        if (imageUrl) {
          await prisma.scene.update({ where: { id: scene.id }, data: { imageUrl } });
          results.push({ sceneNumber: scene.sceneNumber, success: true, imageUrl });
        }
      } catch (err) {
        results.push({
          sceneNumber: scene.sceneNumber,
          success: false,
          error: err instanceof Error ? err.message : "Failed",
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return NextResponse.json({ success: true, total: scenes.length, generated: successCount, results });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
