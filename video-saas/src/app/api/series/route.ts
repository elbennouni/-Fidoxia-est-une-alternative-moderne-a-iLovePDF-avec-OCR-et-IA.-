import { NextRequest } from "next/server";
import { requireUserId } from "@/lib/auth";
import { createSeriesSchema } from "@/lib/schemas";
import { prisma } from "@/lib/prisma";
import { badRequest, created, ok, serverError, unauthorized } from "@/lib/http";

export async function GET(_request: NextRequest) {
  try {
    const userId = await requireUserId(_request);
    if (!userId) {
      return unauthorized("Authentification requise.");
    }

    const data = await prisma.series.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            characters: true,
            environments: true,
            episodes: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok({ series: data });
  } catch (error) {
    return serverError("Impossible de charger les series.", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request);
    if (!userId) {
      return unauthorized("Authentification requise.");
    }

    const payload = await request.json();
    const parsed = createSeriesSchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest("Payload invalide.", parsed.error.flatten());
    }

    const series = await prisma.series.create({
      data: {
        userId,
        ...parsed.data,
      },
    });
    return created({ series });
  } catch (error) {
    return serverError("Impossible de creer la serie.", error);
  }
}
