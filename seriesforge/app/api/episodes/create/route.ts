import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { seriesId, title, format, script } = await req.json();

    const series = await prisma.series.findFirst({ where: { id: seriesId, userId: user.id } });
    if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

    const episode = await prisma.episode.create({
      data: {
        seriesId,
        title,
        format: format || series.defaultFormat,
        script,
        status: "draft",
      },
    });

    return NextResponse.json(episode);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create episode" }, { status: 500 });
  }
}
