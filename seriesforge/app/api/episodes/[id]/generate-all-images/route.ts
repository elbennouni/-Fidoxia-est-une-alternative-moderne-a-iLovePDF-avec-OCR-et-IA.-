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
      include: {
        series: {
          include: { characters: true, environments: true },
        },
      },
    });
    if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

    const { series } = episode;

    const scenes = await prisma.scene.findMany({
      where: { episodeId: id },
      orderBy: { sceneNumber: "asc" },
    });

    const results = [];

    for (const scene of scenes) {
      try {
        // Match characters in this scene
        const sceneCharNames: string[] = JSON.parse(scene.charactersJson || "[]");
        const presentChars = series.characters.filter(c =>
          sceneCharNames.some(n => n.toLowerCase().includes(c.name.toLowerCase()))
        );

        // Match environment
        const matchedEnv = series.environments.find(e =>
          scene.location?.toLowerCase().includes(e.name.toLowerCase())
        ) || series.environments[0];

        // Build character block with consistency + voice
        const charBlock = presentChars.length > 0
          ? presentChars.map(c =>
              `"${c.name}": ${c.physicalDescription}. Outfit: ${c.outfit}. LOCK: ${c.consistencyPrompt}${c.voiceProfile ? ` [Voice: ${c.voiceProfile}]` : ""}.`
            ).join(" | ")
          : sceneCharNames.join(", ");

        const envBlock = matchedEnv
          ? `Location: ${matchedEnv.name} — ${matchedEnv.description}${matchedEnv.lighting ? `. ${matchedEnv.lighting}` : ""}${matchedEnv.mood ? `. ${matchedEnv.mood}` : ""}.`
          : `Location: ${scene.location || "scene"}`;

        const prompt = `${series.visualStyle} cinematic keyframe, ${episode.format} format.
CHARACTERS: ${charBlock}
${envBlock}
Action: ${scene.action || "dramatic moment"}.
Emotion: ${scene.emotion || ""}.
Camera: ${scene.camera || "medium shot"}.
${scene.imagePrompt ? `Style direction: ${scene.imagePrompt.slice(0, 300)}` : ""}
Maintain exact character identity. Same outfits. Same physical appearance. High quality ${series.visualStyle}.`;

        const epFormat = episode.format === "16:9" ? "16:9" : "9:16";
        const size = epFormat === "9:16" ? "1024x1792" : "1792x1024";

        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt.slice(0, 4000),
          n: 1,
          size: size as "1024x1024" | "1024x1792" | "1792x1024",
          quality: "standard",
        });

        const imageUrl = (response.data ?? [])[0]?.url;
        if (imageUrl) {
          await prisma.scene.update({ where: { id: scene.id }, data: { imageUrl } });
          results.push({
            sceneNumber: scene.sceneNumber,
            success: true,
            imageUrl,
            characters: presentChars.map(c => c.name),
            environment: matchedEnv?.name,
          });
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
