import { NextRequest } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, ok, serverError, unauthorized } from "@/lib/http";

type Params = {
  params: Promise<{ seriesId: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(_request);
    if (!userId) {
      return unauthorized("Authentification requise.");
    }

    const { seriesId } = await params;
    const series = await prisma.series.findFirst({
      where: { id: seriesId, userId },
      include: {
        characters: true,
        environments: true,
        episodes: {
          orderBy: { episodeNumber: "asc" },
          include: {
            scenes: {
              orderBy: { sceneOrder: "asc" },
              include: {
                storyboard: true,
                audio: true,
                video: true,
              },
            },
          },
        },
      },
    });

    if (!series) {
      return badRequest("Serie introuvable.");
    }

    return ok({ series });
  } catch (error) {
    return serverError("Impossible de charger la serie.", error);
  }
}
