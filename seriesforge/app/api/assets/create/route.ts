import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { seriesId, type, name, url, prompt, reusable } = await req.json();

    const series = await prisma.series.findFirst({ where: { id: seriesId, userId: user.id } });
    if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

    const asset = await prisma.asset.create({
      data: { seriesId, type, name, url, prompt, reusable: reusable ?? true },
    });

    return NextResponse.json(asset);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const seriesId = searchParams.get("seriesId");

    const assets = await prisma.asset.findMany({
      where: {
        series: { userId: user.id },
        ...(seriesId ? { seriesId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(assets);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}
