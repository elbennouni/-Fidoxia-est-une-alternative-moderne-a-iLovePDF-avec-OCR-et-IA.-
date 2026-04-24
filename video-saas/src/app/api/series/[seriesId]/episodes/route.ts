import { NextRequest } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, created, ok, serverError, unauthorized } from "@/lib/http";
import { createEpisodeSchema } from "@/lib/schemas";

type Params = {
  params: Promise<{ seriesId: string }>;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(_request);
    if (!userId) return unauthorized("Authentification requise.");

    const { seriesId } = await params;
    const series = await prisma.series.findFirst({
      where: { id: seriesId, userId },
      select: { id: true },
    });
    if (!series) return badRequest("Serie introuvable.");

    const episodes = await prisma.episode.findMany({
      where: { seriesId: series.id },
      orderBy: { episodeNumber: "asc" },
    });
    return ok({ episodes });
  } catch (error) {
    return serverError("Impossible de charger les episodes.", error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const userId = await requireUserId(request);
    if (!userId) return unauthorized("Authentification requise.");

    const { seriesId } = await params;
    const series = await prisma.series.findFirst({
      where: { id: seriesId, userId },
      select: { id: true },
    });
    if (!series) return badRequest("Serie introuvable.");

    const parsed = createEpisodeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest("Payload invalide.", parsed.error.flatten());
    }
    const episode = await prisma.episode.create({
      data: {
        seriesId,
        title: parsed.data.title,
        episodeNumber: parsed.data.episodeNumber,
        currentStep: "CHARACTERS",
      },
    });

    return created({ episode });
  } catch (error) {
    return serverError("Impossible de creer l'episode.", error);
  }
}
