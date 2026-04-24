import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildConsistencyPrompt } from "@/lib/agents/characterConsistencyAgent";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { seriesId, name, physicalDescription, outfit, personality, voiceProfile, referenceImageUrl } = await req.json();

    const series = await prisma.series.findFirst({ where: { id: seriesId, userId: user.id } });
    if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

    const consistencyPrompt = buildConsistencyPrompt({ name, physicalDescription, outfit, personality });

    const character = await prisma.character.create({
      data: {
        seriesId,
        name,
        physicalDescription,
        outfit,
        personality,
        voiceProfile,
        referenceImageUrl,
        consistencyPrompt,
      },
    });

    return NextResponse.json(character);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create character" }, { status: 500 });
  }
}
