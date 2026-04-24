import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { seriesId, name, description, lighting, mood, reusable } = await req.json();

    const series = await prisma.series.findFirst({ where: { id: seriesId, userId: user.id } });
    if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

    const environment = await prisma.environment.create({
      data: { seriesId, name, description, lighting, mood, reusable: reusable ?? true },
    });

    return NextResponse.json(environment);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create environment" }, { status: 500 });
  }
}
