import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const series = await prisma.series.findFirst({
      where: { id, userId: user.id },
      include: {
        characters: true,
        environments: true,
        episodes: { orderBy: { createdAt: "desc" } },
        assets: true,
        _count: { select: { episodes: true, characters: true } },
      },
    });

    if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

    return NextResponse.json(series);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch series" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    await prisma.series.deleteMany({ where: { id, userId: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete series" }, { status: 500 });
  }
}
