import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateStoryboardSchema } from "@/lib/schemas";
import {
  buildStoryboardImageUrl,
  ensureEpisodeAccessAndStep,
  toSceneCharacterLines,
  toSceneEnvironment,
  updateEpisodeStep,
} from "@/lib/pipeline-service";
import { buildStoryboardPrompt } from "@/lib/prompts";
import { badRequest, created, ok, serverError, unauthorized } from "@/lib/http";
import { getCurrentUserOrThrow } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ seriesId: string; episodeId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    const { seriesId, episodeId } = await context.params;
    const body = await request.json();
    const parsed = generateStoryboardSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Payload invalide pour generation storyboard", parsed.error.flatten());
    }

    const { episode, series, scenes, characters, environments } = await ensureEpisodeAccessAndStep({
      userId: user.id,
      seriesId,
      episodeId,
      requiredStep: "STORY",
      allowIfCurrentIs: ["STORYBOARD"],
    });

    if (scenes.length === 0) {
      return badRequest("Aucune scene a storyboarder");
    }

    const existingFrames = await prisma.storyboardFrame.findMany({
      where: { sceneId: { in: scenes.map((s) => s.id) } },
      select: { sceneId: true },
    });
    const existingByScene = new Set<string>(existingFrames.map((frame: { sceneId: string }) => frame.sceneId));
    const framesToCreate: Array<{
      sceneId: string;
      prompt: string;
      provider: string;
      imageUrl: string;
    }> = [];
    for (const scene of scenes) {
      if (existingByScene.has(scene.id)) {
        continue;
      }
      const charactersDescription = toSceneCharacterLines(scene.charactersInShot, characters);
      const environmentDescription = toSceneEnvironment(scene.location, environments);
      const prompt = buildStoryboardPrompt({
        style: series.style,
        sceneAction: scene.action,
        sceneEmotion: scene.emotion,
        sceneLocation: environmentDescription,
        characters: charactersDescription
          ? characters.filter((character) =>
              charactersDescription.toLowerCase().includes(character.name.toLowerCase()),
            )
          : characters,
      });

      framesToCreate.push({
        sceneId: scene.id,
        prompt,
        provider: parsed.data.imageProvider,
        imageUrl: buildStoryboardImageUrl(scene.id, parsed.data.imageProvider),
      });
    }

    if (framesToCreate.length > 0) {
      await prisma.storyboardFrame.createMany({ data: framesToCreate });
    }

    await updateEpisodeStep(episode.id, "STORYBOARD");
    return created({
      message: "Storyboard genere (image first)",
      createdFrames: framesToCreate.length,
      skippedExistingFrames: scenes.length - framesToCreate.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return unauthorized();
    }
    return serverError("Erreur generation storyboard", error);
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ seriesId: string; episodeId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    const { seriesId, episodeId } = await context.params;
    await ensureEpisodeAccessAndStep({
      userId: user.id,
      seriesId,
      episodeId,
      requiredStep: "STORYBOARD",
      allowIfCurrentIs: ["AUDIO", "VIDEO", "COMPLETE"],
    });

    const frames = await prisma.storyboardFrame.findMany({
      where: { scene: { episodeId } },
      orderBy: { scene: { sceneOrder: "asc" } },
      include: { scene: true },
    });

    return ok({ frames });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return unauthorized();
    }
    return serverError("Erreur lecture storyboard", error);
  }
}
