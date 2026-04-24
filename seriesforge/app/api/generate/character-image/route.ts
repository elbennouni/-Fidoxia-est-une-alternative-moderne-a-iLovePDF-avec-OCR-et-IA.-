import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureDurableImageUrl } from "@/lib/storage/durableImages";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { characterId, visualStyle } = await req.json();

    const character = await prisma.character.findFirst({
      where: { id: characterId, series: { userId: user.id } },
      include: { series: true },
    });

    if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

    const style = visualStyle || character.series.visualStyle;

    const prompt = `${style} style, character portrait on neutral background, full body view.
Character: ${character.name}.
Appearance: ${character.physicalDescription}.
Outfit: ${character.outfit}.
Personality: ${character.personality}.
High quality, detailed, consistent character design, professional animation style, neutral expression, clear lighting.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1792", // 9:16 portrait for character sheets
      quality: "standard",
    });

    const imageUrl = (response.data ?? [])[0]?.url;
    if (!imageUrl) throw new Error("No image generated");
    const durableImageUrl = await ensureDurableImageUrl(imageUrl, {
      folder: "characters",
      fileNamePrefix: `${character.name}-reference`,
      forceRehostRemote: true,
    });

    await prisma.character.update({
      where: { id: characterId },
      data: { referenceImageUrl: durableImageUrl },
    });

    return NextResponse.json({ imageUrl: durableImageUrl, characterId });
  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
