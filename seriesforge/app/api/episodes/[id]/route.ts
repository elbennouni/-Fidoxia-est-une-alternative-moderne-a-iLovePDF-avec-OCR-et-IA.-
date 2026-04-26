import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getCharacterGroupAssets } from "@/lib/groups/characterGroups";
import {
  getSceneReferenceAssets,
  sceneReferencesNeedPromptRefresh,
} from "@/lib/scenes/sceneReferenceAssets";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const episode = await prisma.episode.findFirst({
      where: { id, series: { userId: user.id } },
      include: {
        series: { include: { characters: true, environments: true, assets: true } },
        scenes: { orderBy: { sceneNumber: "asc" } },
      },
    });

    if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

    const scenes = episode.scenes.map((scene: typeof episode.scenes[number]) => {
      let sceneCharacters: string[] = [];
      let imageHistory: Array<{ url: string; generator: string; createdAt: string }> = [];
      try { sceneCharacters = JSON.parse(scene.charactersJson || "[]"); } catch {}
      try { imageHistory = JSON.parse(scene.imageHistory || "[]"); } catch {}

      const characterRefs = episode.series.characters
        .filter((character: typeof episode.series.characters[number]) => sceneCharacters.some((name) => name.toLowerCase().includes(character.name.toLowerCase())))
        .map((character: typeof episode.series.characters[number]) => ({
          id: character.id,
          name: character.name,
          referenceImageUrl: character.referenceImageUrl,
          visualDNA: character.visualDNA,
          outfit: character.outfit,
        }));

      const matchedEnvironment = episode.series.environments.find((environment: typeof episode.series.environments[number]) =>
        scene.location?.toLowerCase().includes(environment.name.toLowerCase())
      ) || episode.series.environments[0] || null;

      const sceneReferences = getSceneReferenceAssets(episode.series.assets, scene.id);

      return {
        ...scene,
        sceneCharacters,
        imageHistory,
        characterRefs,
        sceneReferences,
        sceneReferencesNeedPromptRefresh: sceneReferencesNeedPromptRefresh(sceneReferences),
        environmentRef: matchedEnvironment ? {
          id: matchedEnvironment.id,
          name: matchedEnvironment.name,
          previewImageUrl: matchedEnvironment.previewImageUrl,
          description: matchedEnvironment.description,
        } : null,
      };
    });

    return NextResponse.json({
      ...episode,
      characterGroups: getCharacterGroupAssets(episode.series.assets),
      scenes,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch episode" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    await prisma.episode.deleteMany({ where: { id, series: { userId: user.id } } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete episode" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const data = await req.json();

    const episode = await prisma.episode.findFirst({
      where: { id, series: { userId: user.id } },
    });
    if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

    const updated = await prisma.episode.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update episode" }, { status: 500 });
  }
}
