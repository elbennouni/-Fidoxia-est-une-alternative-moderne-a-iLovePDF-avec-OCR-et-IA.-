import { NextRequest } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, serverError, unauthorized } from "@/lib/http";

type Params = {
  params: Promise<{ seriesId: string; episodeId: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(request);
    if (!userId) return unauthorized("Authentification requise.");

    const { seriesId, episodeId } = await params;
    const episode = await prisma.episode.findFirst({
      where: {
        id: episodeId,
        seriesId,
        series: { userId },
      },
      include: {
        series: {
          include: {
            characters: { select: { id: true } },
            environments: { select: { id: true } },
          },
        },
        scenes: {
          orderBy: { sceneOrder: "asc" },
          include: {
            storyboard: true,
            audio: true,
            video: true,
          },
        },
      },
    });

    if (!episode) return badRequest("Episode introuvable.");
    return ok({
      episode: {
        id: episode.id,
        title: episode.title,
        episodeNumber: episode.episodeNumber,
        currentStep: episode.currentStep,
        audioValidated: episode.audioValidated,
        scriptOverview: episode.scriptOverview,
      },
      scenes: episode.scenes,
      charactersCount: episode.series.characters.length,
      environmentsCount: episode.series.environments.length,
    });
  } catch (error) {
    return serverError("Impossible de charger l'episode.", error);
  }
}
