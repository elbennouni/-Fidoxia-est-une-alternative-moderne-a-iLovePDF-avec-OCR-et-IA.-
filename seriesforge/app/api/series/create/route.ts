import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { title, description, visualStyle, tone, defaultFormat } = await req.json();

    if (!title || !visualStyle || !tone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const series = await prisma.series.create({
      data: {
        userId: user.id,
        title,
        description,
        visualStyle,
        tone,
        defaultFormat: defaultFormat || "9:16",
      },
    });

    return NextResponse.json(series);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create series" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const series = await prisma.series.findMany({
      where: { userId: user.id },
      include: { _count: { select: { episodes: true, characters: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(series);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch series" }, { status: 500 });
  }
}
