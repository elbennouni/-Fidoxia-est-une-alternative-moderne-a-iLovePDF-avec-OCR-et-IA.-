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
      include: {
        series: { include: { characters: true, environments: true } },
        scenes: { orderBy: { sceneNumber: "asc" } },
      },
    });

    if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

    return NextResponse.json(episode);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch episode" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const data = await req.json();

    const episode = await prisma.episode.findFirst({
      where: { id, series: { userId: user.id } },
    });
    if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

    const updated = await prisma.episode.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update episode" }, { status: 500 });
  }
}
