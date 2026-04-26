import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { optimizeScenePrompts } from "@/lib/agents/promptOptimizerAgent";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json() as {
      optimizeImage?: boolean;
      optimizeVideo?: boolean;
      userInstruction?: string;
    };

    const scene = await prisma.scene.findFirst({
      where: { id, episode: { series: { userId: user.id } } },
      include: {
        episode: {
          include: {
            series: {
              include: {
                characters: true,
                environments: true,
              },
            },
          },
        },
      },
    });

    if (!scene) return NextResponse.json({ error: "Scène non trouvée" }, { status: 404 });

    const characters = scene.episode.series.characters
      .filter((character) =>
        JSON.parse(scene.charactersJson || "[]").some((name: string) => name.toLowerCase().includes(character.name.toLowerCase()))
      )
      .map((character) => ({
        name: character.name,
        physicalDescription: character.physicalDescription,
        outfit: character.outfit,
        consistencyPrompt: character.consistencyPrompt,
      }));

    const environment = scene.episode.series.environments.find((item) =>
      scene.location?.toLowerCase().includes(item.name.toLowerCase())
    );

    const optimized = await optimizeScenePrompts({
      sceneNumber: scene.sceneNumber,
      title: scene.title || `Scène ${scene.sceneNumber}`,
      location: scene.location,
      action: body.userInstruction
        ? `${scene.action || ""}\nInstruction utilisateur: ${body.userInstruction}`.trim()
        : scene.action,
      narration: scene.narration,
      dialogue: scene.dialogue,
      emotion: scene.emotion,
      camera: scene.camera,
      soundDesign: scene.soundDesign,
      imagePrompt: scene.imagePrompt,
      videoPrompt: scene.videoPrompt,
      visualStyle: scene.episode.series.visualStyle,
      format: scene.episode.format,
      characters,
      environments: environment ? [{
        name: environment.name,
        description: environment.description,
        lighting: environment.lighting,
        mood: environment.mood,
      }] : [],
    });

    const updateData: Record<string, string> = {};
    if (body.optimizeImage !== false) updateData.imagePrompt = optimized.imagePrompt;
    if (body.optimizeVideo !== false) updateData.videoPrompt = optimized.videoPrompt;

    await prisma.scene.update({
      where: { id: scene.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      ...optimized,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Optimisation impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
