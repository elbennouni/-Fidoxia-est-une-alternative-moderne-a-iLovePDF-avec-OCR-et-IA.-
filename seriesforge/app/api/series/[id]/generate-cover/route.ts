import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const series = await prisma.series.findFirst({
      where: { id, userId: user.id },
      include: { characters: { take: 4 }, environments: { take: 1 } },
    });
    if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const mainChars = series.characters.map(c => `${c.name}: ${c.physicalDescription}, ${c.outfit}`).join(". ");
    const mainEnv = series.environments[0]?.description || "stunning cinematic landscape";

    const prompt = `${series.visualStyle} style, epic series poster / cover art, 16:9 cinematic format.
Series title: "${series.title}".
Tone: ${series.tone}.
Main characters featured prominently: ${mainChars || "ensemble cast of animated characters"}.
Background setting: ${mainEnv}.
Composition: dramatic hero pose, characters facing viewer, cinematic lighting, depth of field, title-ready composition with space at top or bottom for text overlay.
Style: ${series.visualStyle}, high quality, professional animated series cover, vibrant colors, epic scale.
No text, no titles, no watermarks in the image.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: "1792x1024",
      quality: "hd",
    });

    const coverUrl = (response.data ?? [])[0]?.url;
    if (!coverUrl) throw new Error("No image generated");

    await prisma.series.update({
      where: { id },
      data: { coverImageUrl: coverUrl } as never,
    });

    return NextResponse.json({ coverUrl });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
