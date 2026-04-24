import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildScenePromptWithDNA, generateVisualDNA } from "@/lib/agents/visualDNAAgent";
import type { VisualDNA } from "@/lib/agents/visualDNAAgent";
import { readFile } from "fs/promises";
import path from "path";
import { generateSceneWithNanoBanana } from "@/lib/imageWorkflows/nanoBanana";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function toBase64Uri(imageUrl: string): Promise<string | null> {
  try {
    if (imageUrl.startsWith("/")) {
      const filePath = path.join(process.cwd(), "public", imageUrl);
      const buffer = await readFile(filePath);
      const ext = imageUrl.split(".").pop()?.toLowerCase() || "jpg";
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      return `data:${mime};base64,${buffer.toString("base64")}`;
    }
    return imageUrl;
  } catch { return null; }
}

// GPT-4o Vision: describe character from photo for injection into prompt
async function describeFromPhoto(imageUrl: string, name: string, style: string): Promise<string> {
  try {
    const url = imageUrl.startsWith("/") ? await toBase64Uri(imageUrl) : imageUrl;
    if (!url) return "";
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: `Describe character "${name}" from this image in 60 words for ${style} image generation. Be ultra-specific: face shape, eye color/shape, skin tone, hair color/style, exact clothing with colors, accessories. This will reproduce them exactly.` },
          { type: "image_url", image_url: { url, detail: "high" } }
        ]
      }],
      max_tokens: 150,
      temperature: 0.1,
    });
    return res.choices[0].message.content || "";
  } catch { return ""; }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const episode = await prisma.episode.findFirst({
      where: { id, series: { userId: user.id } },
      include: {
        series: {
          include: { characters: true, environments: true },
        },
      },
    });
    if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

    const { series } = episode;

    // STEP 1: Auto-generate visual DNA for any character missing it
    const dnaGenerated = [];
    for (const char of series.characters) {
      if (!char.visualDNA) {
        const dna = await generateVisualDNA({
          character: {
            name: char.name,
            physicalDescription: char.physicalDescription,
            outfit: char.outfit,
            personality: char.personality,
            referenceImageUrl: char.referenceImageUrl,
          },
          visualStyle: series.visualStyle,
        });

        await prisma.character.update({
          where: { id: char.id },
          data: { visualDNA: JSON.stringify(dna) },
        });

        char.visualDNA = JSON.stringify(dna);
        dnaGenerated.push(char.name);
      }
    }

    // Build character list with DNA
    const characters = series.characters.map((c: typeof series.characters[number]) => ({
      name: c.name,
      consistencyPrompt: c.consistencyPrompt,
      visualDNA: c.visualDNA ? JSON.parse(c.visualDNA) as VisualDNA : null,
    }));

    const scenes = await prisma.scene.findMany({
      where: { episodeId: id },
      orderBy: { sceneNumber: "asc" },
    });

    const results = [];

    for (const scene of scenes) {
      try {
        const sceneCharNames: string[] = JSON.parse(scene.charactersJson || "[]");
        const presentCharCount = series.characters.filter((char: typeof series.characters[number]) =>
          sceneCharNames.some(sc => sc.toLowerCase().includes(char.name.toLowerCase()))
        ).length;

        if (presentCharCount > 1) {
          const nanoResult = await generateSceneWithNanoBanana({
            sceneId: scene.id,
            userId: user.id,
            model: "nano-banana-pro",
          });
          results.push({
            sceneNumber: scene.sceneNumber,
            success: true,
            imageUrl: nanoResult.imageUrl,
            generator: nanoResult.generator,
            autoRouted: true,
          });
          continue;
        }

        const matchedEnv = series.environments.find((e: typeof series.environments[number]) =>
          scene.location?.toLowerCase().includes(e.name.toLowerCase())
        ) || series.environments[0];

        // Build character descriptions: DNA > Vision photo analysis > text
        let photoDescriptions = "";
        for (const char of series.characters) {
          const inScene = sceneCharNames.some(sc => sc.toLowerCase().includes(char.name.toLowerCase()));
          if (!inScene) continue;
          if (char.visualDNA) continue; // already handled by buildScenePromptWithDNA
          if (char.referenceImageUrl) {
            const desc = await describeFromPhoto(char.referenceImageUrl, char.name, series.visualStyle);
            if (desc) photoDescriptions += `\n[${char.name.toUpperCase()} from photo]: ${desc}.`;
          }
        }

        const baseprompt = buildScenePromptWithDNA({
          characters,
          sceneCharacters: sceneCharNames,
          location: scene.location || "",
          environmentDescription: matchedEnv?.description || scene.location || "",
          action: scene.action || "",
          emotion: scene.emotion || "",
          camera: scene.camera || "medium shot",
          visualStyle: series.visualStyle,
          format: episode.format,
          lighting: matchedEnv?.lighting || undefined,
          mood: matchedEnv?.mood || undefined,
        });

        const prompt = photoDescriptions ? `${baseprompt}\n\nADDITIONAL CHARACTER PHOTO REFERENCES:${photoDescriptions}` : baseprompt;

        // Force 9:16 by default (TikTok/Reels)
        const epFormat = episode.format === "16:9" ? "16:9" : "9:16";
        const size = epFormat === "9:16" ? "1024x1792" : "1792x1024";

        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt.slice(0, 4000),
          n: 1,
          size: size as "1024x1024" | "1024x1792" | "1792x1024",
          quality: "hd",
        });

        const imageUrl = (response.data ?? [])[0]?.url;
        if (imageUrl) {
          await prisma.scene.update({ where: { id: scene.id }, data: { imageUrl } });
          results.push({ sceneNumber: scene.sceneNumber, success: true, imageUrl });
        }
      } catch (err) {
        results.push({
          sceneNumber: scene.sceneNumber,
          success: false,
          error: err instanceof Error ? err.message : "Failed",
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: scenes.length,
      generated: results.filter(r => r.success).length,
      dnaAutoGenerated: dnaGenerated,
      results,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
