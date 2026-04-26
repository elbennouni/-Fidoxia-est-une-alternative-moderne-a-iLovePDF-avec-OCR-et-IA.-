import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  analyzeAndNormalizeScenario,
  generateArtisticDirection,
  generateImagePromptsWithDA,
} from "@/lib/agents/scenarioAnalystAgent";
import { upsertScenesBySceneNumber } from "@/lib/scenes/upsertScenes";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { rawScenario, artisticDirective } = await req.json();

    if (!rawScenario) return NextResponse.json({ error: "No scenario provided" }, { status: 400 });

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

    await prisma.episode.update({ where: { id }, data: { status: "generating" } });

    // STEP 1: Analyze and normalize the scenario
    const parsed = await analyzeAndNormalizeScenario({
      rawJson: rawScenario,
      seriesVisualStyle: series.visualStyle,
      seriesTone: series.tone,
      seriesTitle: series.title,
    });

    // STEP 2: Generate artistic direction
    const artisticDirection = await generateArtisticDirection({
      scenario: parsed,
      visualStyle: series.visualStyle,
      tone: series.tone,
      seriesTitle: series.title,
      userDirective: artisticDirective || undefined,
    });

    // STEP 3: Update episode with synopsis
    await prisma.episode.update({
      where: { id },
      data: {
        title: parsed.title || episode.title,
        script: parsed.synopsis,
      },
    });

    // STEP 4: Build new scene payloads without deleting existing media
    // so previously generated scene images/videos/voices remain attached
    // when scene numbers still match.
    const characters = series.characters.map((c: typeof series.characters[number]) => ({
      name: c.name,
      physicalDescription: c.physicalDescription,
      outfit: c.outfit,
      consistencyPrompt: c.consistencyPrompt,
    }));

    const environments = series.environments.map((e: typeof series.environments[number]) => ({
      name: e.name,
      description: e.description,
    }));

    const scenesToCreate = [];

    for (let i = 0; i < parsed.scenes.length; i++) {
      const scene = parsed.scenes[i];
      const prevScene = i > 0 ? parsed.scenes[i - 1] : null;

      const { imagePrompt, videoPrompt } = await generateImagePromptsWithDA({
        scene,
        artisticDirection,
        visualStyle: series.visualStyle,
        format: episode.format,
        characters,
        environments,
        previousSceneContext: prevScene ? `${prevScene.action.slice(0, 100)}` : undefined,
      });

      scenesToCreate.push({
        episodeId: id,
        sceneNumber: scene.sceneNumber,
        timecode: scene.timecode || `${String(Math.floor(i * 30 / 60)).padStart(2, "0")}:${String((i * 30) % 60).padStart(2, "0")}`,
        location: scene.location,
        charactersJson: JSON.stringify(scene.characters),
        action: scene.action,
        narration: scene.narration,
        dialogue: scene.dialogue,
        camera: scene.camera,
        emotion: scene.emotion,
        soundDesign: scene.soundDesign,
        imagePrompt,
        videoPrompt,
        status: "storyboarded",
      });
    }

    await upsertScenesBySceneNumber(id, scenesToCreate);

    await prisma.episode.update({ where: { id }, data: { status: "complete" } });

    // Return full result
    const finalScenes = await prisma.scene.findMany({
      where: { episodeId: id },
      orderBy: { sceneNumber: "asc" },
    });

    return NextResponse.json({
      success: true,
      episodeTitle: parsed.title,
      synopsis: parsed.synopsis,
      sceneCount: finalScenes.length,
      artisticDirection,
      scenes: finalScenes,
    });
  } catch (error) {
    console.error(error);
    await prisma.episode.update({ where: { id: (await params).id }, data: { status: "error" } }).catch(() => {});
    const msg = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
