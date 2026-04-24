import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateVisualDNA } from "@/lib/agents/visualDNAAgent";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { characterId } = await req.json();

    const character = await prisma.character.findFirst({
      where: { id: characterId, series: { userId: user.id } },
      include: { series: true },
    });

    if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

    const visualDNA = await generateVisualDNA({
      character: {
        name: character.name,
        physicalDescription: character.physicalDescription,
        outfit: character.outfit,
        personality: character.personality,
        referenceImageUrl: character.referenceImageUrl,
      },
      visualStyle: character.series.visualStyle,
    });

    // Save DNA to character
    await prisma.character.update({
      where: { id: characterId },
      data: { visualDNA: JSON.stringify(visualDNA) },
    });

    return NextResponse.json({ success: true, visualDNA, characterId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
