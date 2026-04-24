import { NextRequest } from "next/server";
import { createAssetSchema } from "@/lib/schemas";
import { badRequest, ok, serverError, unauthorized } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const assets = await prisma.libraryAsset.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return ok({ assets });
  } catch (error) {
    return serverError("Failed to list library assets", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();

    const parsed = createAssetSchema.safeParse(await request.json());
    if (!parsed.success) {
      return badRequest("Invalid payload", parsed.error.flatten());
    }

    const seriesId = parsed.data.seriesId || null;
    if (seriesId) {
      const series = await prisma.series.findFirst({
        where: { id: seriesId, userId: user.id },
        select: { id: true },
      });
      if (!series) {
        return badRequest("Series not found");
      }
    }

    const asset = await prisma.libraryAsset.create({
      data: {
        userId: user.id,
        seriesId,
        type: parsed.data.type,
        name: parsed.data.name,
        description: parsed.data.description,
        fileUrl: parsed.data.fileUrl,
        reusable: parsed.data.reusable,
        metadata: parsed.data.metadata,
      },
    });

    return ok({ asset }, 201);
  } catch (error) {
    return serverError("Failed to create library asset", error);
  }
}
