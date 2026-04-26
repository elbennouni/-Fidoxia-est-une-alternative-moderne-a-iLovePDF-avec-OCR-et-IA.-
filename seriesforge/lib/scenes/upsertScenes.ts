import { prisma } from "@/lib/db/prisma";

export interface SceneUpsertInput {
  episodeId: string;
  sceneNumber: number;
  timecode?: string | null;
  location?: string | null;
  charactersJson?: string | null;
  action?: string | null;
  narration?: string | null;
  dialogue?: string | null;
  camera?: string | null;
  emotion?: string | null;
  soundDesign?: string | null;
  imagePrompt?: string | null;
  videoPrompt?: string | null;
  status?: string | null;
}

export async function replaceEpisodeScenesPreservingMedia(params: {
  episodeId: string;
  scenes: SceneUpsertInput[];
}) {
  const existingScenes = await prisma.scene.findMany({
    where: { episodeId: params.episodeId },
    orderBy: { sceneNumber: "asc" },
  });

  const existingByNumber = new Map(existingScenes.map((scene) => [scene.sceneNumber, scene]));
  const incomingNumbers = new Set(params.scenes.map((scene) => scene.sceneNumber));

  const upserted = [];

  for (const scene of params.scenes) {
    const existing = existingByNumber.get(scene.sceneNumber);

    if (existing) {
      upserted.push(await prisma.scene.update({
        where: { id: existing.id },
        data: {
          timecode: scene.timecode ?? existing.timecode,
          location: scene.location ?? existing.location,
          charactersJson: scene.charactersJson ?? existing.charactersJson,
          action: scene.action ?? existing.action,
          narration: scene.narration ?? existing.narration,
          dialogue: scene.dialogue ?? existing.dialogue,
          camera: scene.camera ?? existing.camera,
          emotion: scene.emotion ?? existing.emotion,
          soundDesign: scene.soundDesign ?? existing.soundDesign,
          imagePrompt: scene.imagePrompt ?? existing.imagePrompt,
          videoPrompt: scene.videoPrompt ?? existing.videoPrompt,
          status: scene.status ?? existing.status,
        },
      }));
      continue;
    }

    upserted.push(await prisma.scene.create({
      data: {
        episodeId: params.episodeId,
        sceneNumber: scene.sceneNumber,
        timecode: scene.timecode ?? null,
        location: scene.location ?? null,
        charactersJson: scene.charactersJson ?? null,
        action: scene.action ?? null,
        narration: scene.narration ?? null,
        dialogue: scene.dialogue ?? null,
        camera: scene.camera ?? null,
        emotion: scene.emotion ?? null,
        soundDesign: scene.soundDesign ?? null,
        imagePrompt: scene.imagePrompt ?? null,
        videoPrompt: scene.videoPrompt ?? null,
        status: scene.status ?? "scripted",
      },
    }));
  }

  const scenesToDelete = existingScenes.filter((scene) => !incomingNumbers.has(scene.sceneNumber));
  if (scenesToDelete.length > 0) {
    await prisma.scene.deleteMany({
      where: { id: { in: scenesToDelete.map((scene) => scene.id) } },
    });
  }

  return upserted.sort((left, right) => left.sceneNumber - right.sceneNumber);
}

export const upsertEpisodeScenes = replaceEpisodeScenesPreservingMedia;
export const upsertScenesBySceneNumber = async (episodeId: string, scenes: SceneUpsertInput[]) =>
  replaceEpisodeScenesPreservingMedia({ episodeId, scenes });
