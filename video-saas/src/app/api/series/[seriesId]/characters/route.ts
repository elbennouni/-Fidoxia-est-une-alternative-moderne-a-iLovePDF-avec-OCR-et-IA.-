import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCharacterSchema } from "@/lib/schemas";
import { getUserFromRequest } from "@/lib/auth";
import { badRequest, created, ok, serverError, unauthorized } from "@/lib/http";

type Context = {
  params: Promise<{ seriesId: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();
    const { seriesId } = await context.params;

    const series = await prisma.series.findFirst({
      where: { id: seriesId, userId: user.id },
      select: { id: true },
    });
    if (!series) return badRequest("Serie introuvable.");

    const data = await prisma.character.findMany({
      where: { seriesId },
      orderBy: { createdAt: "asc" },
    });

    return ok({ characters: data });
  } catch (error) {
    return serverError("Erreur chargement personnages", error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return unauthorized();
    const { seriesId } = await context.params;

    const series = await prisma.series.findFirst({
      where: { id: seriesId, userId: user.id },
      select: { id: true },
    });
    if (!series) return badRequest("Serie introuvable.");

    const body = await request.json();
    const parsed = createCharacterSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Payload invalide.", parsed.error.flatten());
    }

    const character = await prisma.character.create({
      data: {
        ...parsed.data,
        referenceImage: parsed.data.referenceImage || null,
        seriesId,
      },
    });

    return created({ character });
  } catch (error) {
    return serverError("Erreur creation personnage", error);
  }
}
