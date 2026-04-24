import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Replicate from "replicate";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { IMAGE_GENERATORS } from "@/lib/generators";
import { readFile } from "fs/promises";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Read local file or return external URL as-is
async function toBase64Uri(imageUrl: string): Promise<string | null> {
  try {
    if (imageUrl.startsWith("/")) {
      const filePath = path.join(process.cwd(), "public", imageUrl);
      const buffer = await readFile(filePath);
      const ext = imageUrl.split(".").pop()?.toLowerCase() || "jpg";
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      return `data:${mime};base64,${buffer.toString("base64")}`;
    }
    return imageUrl; // external URL
  } catch {
    return null;
  }
}

// Use GPT-4o Vision to describe a character photo in ultra-detail
// This is used when the generator does NOT support img2img (e.g. DALL-E 3)
async function describeCharacterFromPhoto(
  imageUrl: string,
  characterName: string,
  visualStyle: string
): Promise<string> {
  try {
    let imageContent: { type: "image_url"; image_url: { url: string; detail: "high" } };
    if (imageUrl.startsWith("/")) {
      const base64 = await toBase64Uri(imageUrl);
      if (!base64) return "";
      imageContent = { type: "image_url", image_url: { url: base64, detail: "high" } };
    } else {
      imageContent = { type: "image_url", image_url: { url: imageUrl, detail: "high" } };
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Describe this character "${characterName}" in extreme visual detail for ${visualStyle} image generation.
Write a single dense paragraph (60-80 words) describing ONLY what you see:
face shape, eye color and shape, nose, mouth, skin tone, hair color and style, body type, exact clothing items with colors, accessories.
This description will be injected into an image generation prompt to reproduce this EXACT person.
Be specific: colors, textures, proportions. No general terms.`
          },
          imageContent
        ]
      }],
      max_tokens: 200,
      temperature: 0.1,
    });

    return response.choices[0].message.content || "";
  } catch {
    return "";
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

    // Get characters present in this scene WITH their reference photos
    const presentChars = series.characters.filter(c =>
      sceneCharNames.some(sc => sc.toLowerCase().includes(c.name.toLowerCase()))
    );

    // Get matching environment
    const matchedEnv = series.environments.find(e =>
      scene.location?.toLowerCase().includes(e.name.toLowerCase())
    ) || series.environments[0];

    const envPreview = (matchedEnv as typeof matchedEnv & { previewImageUrl?: string | null })?.previewImageUrl;

    // Build reference images list (characters first, then env)
    const refImages: Array<{ type: string; name: string; url: string }> = [
      ...presentChars.filter(c => c.referenceImageUrl).map(c => ({
        type: "character",
        name: c.name,
        url: c.referenceImageUrl!,
      })),
      ...(envPreview ? [{ type: "environment", name: matchedEnv!.name, url: envPreview }] : []),
    ];

    // ─── BUILD THE PROMPT ───────────────────────────────────────────────────────

    // For all generators: build character block using visual DNA + optionally Vision analysis
    let charDescriptions = "";
    for (const char of presentChars) {
      // Priority 1: visual DNA locked prompt (already analyzed from photo)
      if (char.visualDNA) {
        try {
          const dna = JSON.parse(char.visualDNA);
          charDescriptions += `\n[${char.name.toUpperCase()}]: ${dna.lockedPrompt || dna.distinctiveFeature || ""}. `;
          continue;
        } catch {}
      }

      // Priority 2: if has reference photo but no DNA → use Vision to describe
      if (char.referenceImageUrl && generator.provider === "OpenAI") {
        const visionDesc = await describeCharacterFromPhoto(
          char.referenceImageUrl,
          char.name,
          series.visualStyle
        );
        if (visionDesc) {
          charDescriptions += `\n[${char.name.toUpperCase()}] (from reference photo): ${visionDesc}. `;
          continue;
        }
      }

      // Priority 3: fallback to text description
      charDescriptions += `\n[${char.name.toUpperCase()}]: ${char.physicalDescription}. Outfit: ${char.outfit}. ${char.consistencyPrompt}. `;
    }

    const envDescription = matchedEnv
      ? `${matchedEnv.name}: ${matchedEnv.description}${matchedEnv.lighting ? `. Lighting: ${matchedEnv.lighting}` : ""}${matchedEnv.mood ? `. Mood: ${matchedEnv.mood}` : ""}`
      : scene.location || "";

    const prompt = `${series.visualStyle}, ${format} format, cinematic keyframe.

STRICT CHARACTER IDENTITY — REPRODUCE EXACTLY AS DESCRIBED:${charDescriptions}

LOCATION: ${envDescription}

ACTION: ${scene.action || ""}
EMOTION: ${scene.emotion || ""}
CAMERA: ${scene.camera || "medium shot"}

CRITICAL: Render ONLY in ${series.visualStyle} style. Maintain exact character appearance from reference descriptions. Same face, same outfit, same accessories. No character identity changes allowed.`;

    // ─── GENERATE ───────────────────────────────────────────────────────────────

    const width = format === "9:16" ? 576 : 1024;
    const height = format === "9:16" ? 1024 : 576;
    let imageUrl = "";

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

      // img2img: pass character photo as reference
      if (generator.supportsImgToImg && refImages.length > 0) {
        const charRef = refImages.find(r => r.type === "character");
        if (charRef) {
          const uri = await toBase64Uri(charRef.url);
          if (uri) {
            replicateInput.image = uri;
            replicateInput.prompt_strength = 0.82;
          }
        }
      }

      if (generator.id === "flux-schnell") {
        delete replicateInput.output_quality;
        replicateInput.num_inference_steps = 4;
      }
      if (generator.id.startsWith("flux-dev") || generator.id.startsWith("flux-pro")) {
        replicateInput.guidance = 3.5;
        replicateInput.num_inference_steps = 28;
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

    } else if (generator.provider === "Fal.ai" && process.env.FAL_API_KEY) {
      const falBody: Record<string, unknown> = {
        prompt: prompt.slice(0, 2000),
        image_size: format === "9:16" ? "portrait_9_16" : "landscape_16_9",
        num_images: 1,
        enable_safety_checker: false,
      };

      if (generator.supportsImgToImg && refImages.length > 0) {
        const charRef = refImages.find(r => r.type === "character");
        if (charRef) {
          const uri = await toBase64Uri(charRef.url);
          if (uri) { falBody.image_url = uri; falBody.strength = 0.82; }
        }
      }

      const falRes = await fetch(`https://fal.run/${generator.model}`, {
        method: "POST",
        headers: { "Authorization": `Key ${process.env.FAL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(falBody),
      });
      if (!falRes.ok) throw new Error(`Fal.ai ${falRes.status}: ${await falRes.text()}`);
      const falData = await falRes.json();
      imageUrl = falData.images?.[0]?.url || falData.image?.url || "";

    } else if (generator.provider === "Together.ai" && process.env.TOGETHER_API_KEY) {
      const togetherRes = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.TOGETHER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: generator.model, prompt: prompt.slice(0, 2000), width, height, steps: 4, n: 1 }),
      });
      if (!togetherRes.ok) throw new Error(`Together.ai ${togetherRes.status}`);
      const togetherData = await togetherRes.json();
      imageUrl = togetherData.data?.[0]?.url || "";

    } else if (generator.provider === "HuggingFace" && process.env.HUGGINGFACE_API_KEY) {
      const hfRes = await fetch(`https://api-inference.huggingface.co/models/${generator.model}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: prompt.slice(0, 1500) }),
      });
      if (!hfRes.ok) throw new Error(`HuggingFace ${hfRes.status}`);
      const hfBuffer = Buffer.from(await (await hfRes.blob()).arrayBuffer());
      imageUrl = `data:image/jpeg;base64,${hfBuffer.toString("base64")}`;

    } else if (generator.provider === "Stability AI" && process.env.STABILITY_API_KEY) {
      const form = new FormData();
      form.append("prompt", prompt.slice(0, 2000));
      form.append("aspect_ratio", format === "9:16" ? "9:16" : "16:9");
      form.append("output_format", "webp");
      const stabRes = await fetch(`https://api.stability.ai/v2beta/${generator.model}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.STABILITY_API_KEY}`, "Accept": "image/*" },
        body: form,
      });
      if (!stabRes.ok) throw new Error(`Stability AI ${stabRes.status}`);
      const stabBuffer = Buffer.from(await stabRes.arrayBuffer());
      imageUrl = `data:image/webp;base64,${stabBuffer.toString("base64")}`;
    }

    if (!imageUrl) throw new Error("No image generated — check API key for " + generator.provider);

    // Save previous image to history
    const currentScene = await prisma.scene.findUnique({ where: { id: sceneId }, select: { imageUrl: true, imageHistory: true } });
    let history: Array<{ url: string; generator: string; createdAt: string }> = [];
    try { history = JSON.parse(currentScene?.imageHistory || "[]"); } catch {}
    if (currentScene?.imageUrl) {
      history.unshift({ url: currentScene.imageUrl, generator: generator.name, createdAt: new Date().toISOString() });
      if (history.length > 10) history = history.slice(0, 10);
    }

    await prisma.scene.update({
      where: { id: sceneId },
      data: { imageUrl, imageHistory: JSON.stringify(history) },
    });

    return NextResponse.json({
      imageUrl,
      sceneId,
      generator: generator.name,
      refImagesUsed: refImages.map(r => `${r.name} (${r.type})`),
      charactersWithPhoto: presentChars.filter(c => c.referenceImageUrl).map(c => c.name),
      charactersWithDNA: presentChars.filter(c => c.visualDNA).map(c => c.name),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
