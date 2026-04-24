import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, unauthorized } from "@/lib/http";

export async function GET() {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return unauthorized();
    }
    const [seriesCount, episodeCount, sceneCount, videoCount, assetCount, recentSeries] =
      await Promise.all([
        prisma.series.count({ where: { userId } }),
        prisma.episode.count({ where: { series: { userId } } }),
        prisma.scene.count({ where: { episode: { series: { userId } } } }),
        prisma.videoShot.count({ where: { scene: { episode: { series: { userId } } } } }),
        prisma.libraryAsset.count({ where: { userId } }),
        prisma.series.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          take: 6,
          include: {
            episodes: {
              orderBy: { episodeNumber: "desc" },
              take: 1,
            },
          },
        }),
      ]);

    return ok({
      stats: {
        seriesCount,
        episodeCount,
        sceneCount,
        videoCount,
        assetCount,
      },
      recentSeries,
    });
  } catch (error) {
    return unauthorized(error instanceof Error ? error.message : "Unable to load dashboard");
  }
}
