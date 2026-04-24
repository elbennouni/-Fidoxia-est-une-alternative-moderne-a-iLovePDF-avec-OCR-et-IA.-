import { NextRequest } from "next/server";
import { createEnvironmentSchema } from "@/lib/schemas";
import { getAuthUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { badRequest, created, ok, unauthorized, notFound, serverError } from "@/lib/http";

type RouteParams = { params: Promise<{ seriesId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return unauthorized("Authentification requise.");
    const { seriesId } = await params;

    const series = await prisma.series.findFirst({
      where: { id: seriesId, userId: user.id },
      select: { id: true },
    });
    if (!series) return notFound("Serie introuvable.");

    const environments = await prisma.environment.findMany({
      where: { seriesId },
      orderBy: { createdAt: "asc" },
    });

    return ok({ environments });
  } catch (error) {
    return serverError("Erreur lecture environnements", error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return unauthorized("Authentification requise.");
    const { seriesId } = await params;

    const series = await prisma.series.findFirst({
      where: { id: seriesId, userId: user.id },
      select: { id: true },
    });
    if (!series) return notFound("Serie introuvable.");

    const parsed = createEnvironmentSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return badRequest("Payload invalide.", parsed.error.flatten());

    const environment = await prisma.environment.create({
      data: {
        seriesId,
        locationName: parsed.data.locationName,
        visualDescription: parsed.data.visualDescription,
        lighting: parsed.data.lighting,
        mood: parsed.data.mood,
        reusable: parsed.data.reusable,
      },
    });

    return created({ environment });
  } catch (error) {
    return serverError("Erreur creation environnement", error);
  }
}
