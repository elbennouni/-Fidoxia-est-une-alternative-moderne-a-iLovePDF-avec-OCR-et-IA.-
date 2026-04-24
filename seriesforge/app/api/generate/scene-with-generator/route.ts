import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Replicate from "replicate";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildScenePromptWithDNA } from "@/lib/agents/visualDNAAgent";
import type { VisualDNA } from "@/lib/agents/visualDNAAgent";
import { IMAGE_GENERATORS } from "@/lib/generators";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sceneId, generatorId } = await req.json();

    const scene = await prisma.scene.findFirst({
      where: { id: sceneId, episode: { series: { userId: user.id } } },
      include: {
        episode: {
          include: {
            series: { include: { characters: true, environments: true } },
          },
        },
      },
    });

    if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

    const { series } = scene.episode;
    const format = scene.episode.format;
    const generator = IMAGE_GENERATORS.find(g => g.id === (generatorId || "dalle3-hd")) || IMAGE_GENERATORS[0];

    const sceneCharNames: string[] = JSON.parse(scene.charactersJson || "[]");
    const presentChars = series.characters.filter(c =>
      sceneCharNames.some(sc => sc.toLowerCase().includes(c.name.toLowerCase()))
    );

    const matchedEnv = series.environments.find(e =>
      scene.location?.toLowerCase().includes(e.name.toLowerCase())
    ) || series.environments[0];

    // Build DNA-rich prompt
    const characters = series.characters.map(c => ({
      name: c.name,
      consistencyPrompt: c.consistencyPrompt,
      visualDNA: c.visualDNA ? JSON.parse(c.visualDNA) as VisualDNA : null,
    }));

    const prompt = buildScenePromptWithDNA({
      characters,
      sceneCharacters: sceneCharNames,
      location: scene.location || "",
      environmentDescription: matchedEnv?.description || "",
      action: scene.action || "",
      emotion: scene.emotion || "",
      camera: scene.camera || "medium shot",
      visualStyle: series.visualStyle,
      format,
      lighting: matchedEnv?.lighting || undefined,
      mood: matchedEnv?.mood || undefined,
    });

    // Get reference images for img2img
    const refImages = [
      ...presentChars
        .filter(c => c.referenceImageUrl)
        .map(c => ({ type: "character", name: c.name, url: c.referenceImageUrl! })),
      ...(matchedEnv as { previewImageUrl?: string | null } & typeof matchedEnv)?.previewImageUrl
        ? [{ type: "environment", name: matchedEnv!.name, url: (matchedEnv as { previewImageUrl?: string }).previewImageUrl! }]
        : [],
    ];

    let imageUrl = "";
    const width = format === "9:16" ? 576 : 1024;
    const height = format === "9:16" ? 1024 : 576;

    if (generator.provider === "OpenAI") {
      const quality = generator.id.includes("hd") ? "hd" : "standard";
      const size = format === "9:16" ? "1024x1792" : "1792x1024";

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt.slice(0, 4000),
        n: 1,
        size: size as "1024x1024" | "1024x1792" | "1792x1024",
        quality: quality as "standard" | "hd",
      });
      imageUrl = (response.data ?? [])[0]?.url || "";

    } else if (generator.provider === "Replicate" && generator.replicateModel) {
      const replicateInput: Record<string, unknown> = {
        prompt: prompt.slice(0, 2000),
        width,
        height,
        num_outputs: 1,
        output_format: "webp",
        output_quality: 90,
      };

      // Add reference image for img2img if available
      if (generator.supportsImgToImg && refImages.length > 0) {
        // Use first character reference or environment
        const charRef = refImages.find(r => r.type === "character");
        const envRef = refImages.find(r => r.type === "environment");
        if (charRef) replicateInput.image = charRef.url;
        if (envRef && !charRef) replicateInput.image = envRef.url;
        replicateInput.prompt_strength = 0.75;
      }

      if (generator.id === "flux-schnell") {
        delete replicateInput.output_quality;
        replicateInput.num_inference_steps = 4;
      }
      if (generator.id === "flux-dev" || generator.id === "flux-pro") {
        replicateInput.guidance = 3.5;
        replicateInput.num_inference_steps = generator.id === "flux-dev" ? 28 : 25;
      }
      if (generator.id === "sdxl") {
        replicateInput.num_inference_steps = 40;
        replicateInput.guidance_scale = 7.5;
      }

      const output = await replicate.run(generator.replicateModel as `${string}/${string}`, { input: replicateInput });

      if (Array.isArray(output) && output.length > 0) {
        imageUrl = typeof output[0] === "string" ? output[0] : String(output[0]);
      } else if (typeof output === "string") {
        imageUrl = output;
      }
    }

    if (!imageUrl) throw new Error("No image generated");

    await prisma.scene.update({ where: { id: sceneId }, data: { imageUrl } });

    return NextResponse.json({
      imageUrl,
      sceneId,
      generator: generator.name,
      refImagesUsed: refImages.map(r => r.name),
      charactersUsed: presentChars.map(c => c.name),
      environmentUsed: matchedEnv?.name || null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
