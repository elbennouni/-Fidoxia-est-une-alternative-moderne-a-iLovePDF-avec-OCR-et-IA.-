import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Replicate from "replicate";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildScenePromptWithDNA } from "@/lib/agents/visualDNAAgent";
import type { VisualDNA } from "@/lib/agents/visualDNAAgent";
import { IMAGE_GENERATORS } from "@/lib/generators";
import { readFile } from "fs/promises";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Convert a local /uploads/... path OR external URL to a base64 data URI
async function toReplicateImageUri(imageUrl: string): Promise<string | null> {
  try {
    // External URL — Replicate can use it directly if it's truly public
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      // DALL-E generated URLs are public — use directly
      if (imageUrl.includes("oaidalleapiprodscus") || imageUrl.includes("openai")) {
        return imageUrl;
      }
      // Other external URLs — use directly, may work
      return imageUrl;
    }

    // Local file (/uploads/characters/xxx.png) — convert to base64
    if (imageUrl.startsWith("/")) {
      const filePath = path.join(process.cwd(), "public", imageUrl);
      const fileBuffer = await readFile(filePath);
      const ext = imageUrl.split(".").pop()?.toLowerCase() || "jpg";
      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      return `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
    }

    return null;
  } catch {
    return null;
  }
}

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

    } else if (generator.provider === "Fal.ai" && process.env.FAL_API_KEY) {
      const falResponse = await fetch(`https://fal.run/${generator.model}`, {
        method: "POST",
        headers: {
          "Authorization": `Key ${process.env.FAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.slice(0, 2000),
          image_size: format === "9:16" ? "portrait_16_9" : "landscape_16_9",
          num_images: 1,
          enable_safety_checker: false,
          ...(generator.supportsImgToImg && refImages.length > 0 ? {
            image_url: await toReplicateImageUri(refImages[0].url),
            strength: 0.8,
          } : {}),
        }),
      });
      if (!falResponse.ok) throw new Error(`Fal.ai error: ${falResponse.status}`);
      const falData = await falResponse.json();
      imageUrl = falData.images?.[0]?.url || falData.image?.url || "";

    } else if (generator.provider === "Together.ai" && process.env.TOGETHER_API_KEY) {
      const togetherResponse = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.TOGETHER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: generator.model,
          prompt: prompt.slice(0, 2000),
          width,
          height,
          steps: 4,
          n: 1,
        }),
      });
      if (!togetherResponse.ok) throw new Error(`Together.ai error: ${togetherResponse.status}`);
      const togetherData = await togetherResponse.json();
      imageUrl = togetherData.data?.[0]?.url || "";

    } else if (generator.provider === "HuggingFace" && process.env.HUGGINGFACE_API_KEY) {
      const hfResponse = await fetch(`https://api-inference.huggingface.co/models/${generator.model}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: prompt.slice(0, 1500) }),
      });
      if (!hfResponse.ok) throw new Error(`HuggingFace error: ${hfResponse.status}`);
      const hfBlob = await hfResponse.blob();
      const hfBuffer = Buffer.from(await hfBlob.arrayBuffer());
      imageUrl = `data:image/jpeg;base64,${hfBuffer.toString("base64")}`;

    } else if (generator.provider === "Stability AI" && process.env.STABILITY_API_KEY) {
      const stabilityResponse = await fetch(`https://api.stability.ai/v2beta/${generator.model}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.STABILITY_API_KEY}`,
          "Accept": "image/*",
        },
        body: (() => {
          const form = new FormData();
          form.append("prompt", prompt.slice(0, 2000));
          form.append("aspect_ratio", format === "9:16" ? "9:16" : "16:9");
          form.append("output_format", "webp");
          return form;
        })(),
      });
      if (!stabilityResponse.ok) throw new Error(`Stability AI error: ${stabilityResponse.status}`);
      const stabBuffer = Buffer.from(await stabilityResponse.arrayBuffer());
      imageUrl = `data:image/webp;base64,${stabBuffer.toString("base64")}`;

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
        const charRef = refImages.find(r => r.type === "character");
        const envRef = refImages.find(r => r.type === "environment");
        const refSource = charRef || envRef;

        if (refSource) {
          const imageUri = await toReplicateImageUri(refSource.url);
          if (imageUri) {
            replicateInput.image = imageUri;
            replicateInput.prompt_strength = 0.80; // higher = more faithful to prompt, lower = more like reference
          }
        }
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

    // Save previous image to history before overwriting
    const currentScene = await prisma.scene.findUnique({ where: { id: sceneId }, select: { imageUrl: true, imageHistory: true } });
    let history: Array<{ url: string; generator: string; createdAt: string }> = [];
    try { history = JSON.parse(currentScene?.imageHistory || "[]"); } catch {}
    if (currentScene?.imageUrl) {
      history.unshift({ url: currentScene.imageUrl, generator: generator.name, createdAt: new Date().toISOString() });
      if (history.length > 10) history = history.slice(0, 10); // max 10 in history
    }

    await prisma.scene.update({ where: { id: sceneId }, data: { imageUrl, imageHistory: JSON.stringify(history) } });

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
