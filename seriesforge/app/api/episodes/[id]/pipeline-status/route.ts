import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const episode = await prisma.episode.findFirst({
      where: { id, series: { userId: user.id } },
      include: { scenes: { select: { id: true, imageUrl: true, imageHistory: true, status: true } } },
    });

    if (!episode) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const hasScenes = episode.scenes.length > 0;
    const hasImages = episode.scenes.some(s => s.imageUrl);
    const totalImages = episode.scenes.filter(s => s.imageUrl).length;
    const totalHistory = episode.scenes.reduce((sum, s) => {
      try { return sum + JSON.parse(s.imageHistory || "[]").length; } catch { return sum; }
    }, 0);

    return NextResponse.json({
      hasScenes,
      hasImages,
      sceneCount: episode.scenes.length,
      imageCount: totalImages,
      historyCount: totalHistory,
      status: episode.status,
    });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
