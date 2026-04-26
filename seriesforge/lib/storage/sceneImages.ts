import { prisma } from "@/lib/db/prisma";
import { persistGeneratedImageUrl } from "@/lib/storage/durableImages";

export async function persistSceneImage(params: {
  sceneId: string;
  imageUrl: string;
  generator: string;
  folder?: string;
}): Promise<{ imageUrl: string; history: Array<{ url: string; generator: string; createdAt: string }> }> {
  const { sceneId, imageUrl, generator, folder = "scenes" } = params;

  const durableImageUrl = await persistGeneratedImageUrl(imageUrl, {
    folder,
    fallbackName: `${folder}-${sceneId}`,
  });

  const currentScene = await prisma.scene.findUnique({
    where: { id: sceneId },
    select: { imageUrl: true, imageHistory: true },
  });

  let history: Array<{ url: string; generator: string; createdAt: string }> = [];
  try {
    history = JSON.parse(currentScene?.imageHistory || "[]");
  } catch {
    history = [];
  }

  if (currentScene?.imageUrl) {
    history.unshift({
      url: currentScene.imageUrl,
      generator,
      createdAt: new Date().toISOString(),
    });
    if (history.length > 10) history = history.slice(0, 10);
  }

  await prisma.scene.update({
    where: { id: sceneId },
    data: {
      imageUrl: durableImageUrl,
      imageHistory: JSON.stringify(history),
    },
  });

  return {
    imageUrl: durableImageUrl,
    history,
  };
}

export const persistSceneImageResult = async (params: {
  sceneId: string;
  imageUrl: string;
  generatorName: string;
  folder?: string;
  fileNamePrefix?: string;
}) => {
  const result = await persistSceneImage({
    sceneId: params.sceneId,
    imageUrl: params.imageUrl,
    generator: params.generatorName,
    folder: params.folder,
  });
  return result.imageUrl;
};

export const persistSceneImageWithHistory = persistSceneImageResult;
export const persistSceneImageAndHistory = persistSceneImageResult;
export const persistSceneGeneratedImage = persistSceneImageResult;
