import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { characterId } = await req.json();

    const character = await prisma.character.findFirst({
      where: { id: characterId, series: { userId: user.id } },
      include: { series: true },
    });

    if (!character) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!character.referenceImageUrl) {
      return NextResponse.json({ error: "No reference image — upload a photo first" }, { status: 400 });
    }

    const visualStyle = character.series.visualStyle;

    // Resolve image URL — local uploads need to be base64 for GPT-4o Vision
    let imageContent: { type: "image_url"; image_url: { url: string; detail: "high" } };
    const refUrl = character.referenceImageUrl!;

    if (refUrl.startsWith("/")) {
      // Local file — convert to base64
      const filePath = path.join(process.cwd(), "public", refUrl);
      const fileBuffer = await readFile(filePath);
      const ext = refUrl.split(".").pop()?.toLowerCase() || "jpg";
      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const dataUri = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
      imageContent = { type: "image_url", image_url: { url: dataUri, detail: "high" } };
    } else {
      imageContent = { type: "image_url", image_url: { url: refUrl, detail: "high" } };
    }

    // Use GPT-4o Vision to analyze the actual photo
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a Pixar character designer. Analyze this character reference image and extract an ultra-precise visual DNA that will be used to reproduce this EXACT character in ${visualStyle} style consistently across all generated scenes.

Name: ${character.name}
Written description: ${character.physicalDescription}
Outfit described: ${character.outfit}

Analyze the image and return ONLY valid JSON with these exact fields — be extremely specific about what you actually SEE in the image:

{
  "faceShape": "exact face shape you see",
  "eyeColor": "exact eye color and shape you see",
  "eyeShape": "precise eye shape",
  "noseShape": "nose shape",
  "mouthShape": "mouth/lips shape",
  "skinTone": "exact skin tone with undertone",
  "hairColor": "exact hair color",
  "hairStyle": "exact hairstyle as seen",
  "bodyType": "body type visible",
  "height": "relative height impression",
  "topClothing": "exact top clothing visible",
  "bottomClothing": "exact bottom clothing visible",
  "shoes": "footwear or none",
  "accessories": "all accessories visible",
  "colorPalette": "dominant color palette of the character",
  "pixarFeatures": "how to render in ${visualStyle}: specific Pixar 3D features, proportions, shading",
  "facialExpression": "default expression seen",
  "distinctiveFeature": "the ONE most recognizable visual element",
  "lockedPrompt": "A 100-word ultra-precise prompt that would reproduce this EXACT character in ${visualStyle} — include all physical details, outfit, colors, Pixar 3D style specifications"
}`
            },
            imageContent
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const visualDNA = JSON.parse(response.choices[0].message.content || "{}");

    // Save to character
    await prisma.character.update({
      where: { id: characterId },
      data: {
        visualDNA: JSON.stringify(visualDNA),
        consistencyPrompt: `Always keep this exact character identity: ${character.name}, ${visualDNA.skinTone} skin, ${visualDNA.hairColor} ${visualDNA.hairStyle} hair, ${visualDNA.eyeShape} ${visualDNA.eyeColor} eyes, wearing ${visualDNA.topClothing}, ${visualDNA.bottomClothing}, ${visualDNA.accessories}. Distinctive: ${visualDNA.distinctiveFeature}. Never change face, outfit, or visual identity.`,
      },
    });

    return NextResponse.json({ success: true, visualDNA, characterId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
