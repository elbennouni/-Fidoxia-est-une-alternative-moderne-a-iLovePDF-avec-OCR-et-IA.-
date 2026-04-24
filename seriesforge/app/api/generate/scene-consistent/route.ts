import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildScenePromptWithDNA } from "@/lib/agents/visualDNAAgent";
import type { VisualDNA } from "@/lib/agents/visualDNAAgent";
import { runNanoBananaWorkflow } from "@/lib/imageWorkflows/nanoBanana";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sceneId } = await req.json();

    const scene = await prisma.scene.findFirst({
      where: { id: sceneId, episode: { series: { userId: user.id } } },
      include: {
        episode: {
          include: {
            series: {
              include: {
                characters: true,
                environments: true,
              },
            },
          },
        },
      },
    });

    if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

    const { series } = scene.episode;
    const format = scene.episode.format;

    const sceneCharNames: string[] = JSON.parse(scene.charactersJson || "[]");
    const presentChars = series.characters.filter((c: typeof series.characters[number]) =>
      sceneCharNames.some((n: string) => n.toLowerCase().includes(c.name.toLowerCase()))
    );
    if (presentChars.length > 1) {
      const result = await runNanoBananaWorkflow({
        sceneId,
        userId: user.id,
        model: "nano-banana-pro",
      });
      return NextResponse.json({
        ...result,
        autoRoutedToNanoBanana: true,
        characters: presentChars.map((c: typeof presentChars[number]) => c.name),
      });
    }

    // Match environment
    const matchedEnv = series.environments.find((e: typeof series.environments[number]) =>
      scene.location?.toLowerCase().includes(e.name.toLowerCase())
    ) || series.environments[0];

    // Build character data with visual DNA
    const characters = series.characters.map((c: typeof series.characters[number]) => ({
      name: c.name,
      consistencyPrompt: c.consistencyPrompt,
      visualDNA: c.visualDNA ? JSON.parse(c.visualDNA) as VisualDNA : null,
    }));

    // Check if all characters have DNA, warn if not
    const charsInScene = characters.filter((c: typeof characters[number]) =>
      sceneCharNames.some((sc: string) => sc.toLowerCase().includes(c.name.toLowerCase()))
    );
    const missingDNA = charsInScene.filter((c: typeof charsInScene[number]) => !c.visualDNA).map((c: typeof charsInScene[number]) => c.name);

    // Build the scene prompt with full DNA
    const prompt = buildScenePromptWithDNA({
      characters,
      sceneCharacters: sceneCharNames,
      location: scene.location || "",
      environmentDescription: matchedEnv?.description || scene.location || "",
      action: scene.action || "",
      emotion: scene.emotion || "",
      camera: scene.camera || "medium shot",
      visualStyle: series.visualStyle,
      format,
      lighting: matchedEnv?.lighting || undefined,
      mood: matchedEnv?.mood || undefined,
    });

    const size = format === "9:16" ? "1024x1792" : "1792x1024";

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: size as "1024x1024" | "1024x1792" | "1792x1024",
      quality: "hd",
    });

    const imageUrl = (response.data ?? [])[0]?.url;
    if (!imageUrl) throw new Error("No image generated");

    // Save previous image to history
    const currentScene = await prisma.scene.findUnique({ where: { id: sceneId }, select: { imageUrl: true, imageHistory: true } });
    let history: Array<{ url: string; generator: string; createdAt: string }> = [];
    try { history = JSON.parse(currentScene?.imageHistory || "[]"); } catch {}
    if (currentScene?.imageUrl) {
      history.unshift({ url: currentScene.imageUrl, generator: "DALL-E 3 HD", createdAt: new Date().toISOString() });
      if (history.length > 10) history = history.slice(0, 10);
    }

    await prisma.scene.update({ where: { id: sceneId }, data: { imageUrl, imageHistory: JSON.stringify(history) } });

    return NextResponse.json({
      imageUrl,
      sceneId,
      charactersUsed: charsInScene.map((c: typeof charsInScene[number]) => c.name),
      missingDNA,
      environmentUsed: matchedEnv?.name || null,
      promptLength: prompt.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
