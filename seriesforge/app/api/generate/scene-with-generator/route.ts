import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Replicate from "replicate";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { IMAGE_GENERATORS } from "@/lib/generators";
import { buildNanoBananaPayload } from "@/lib/imageWorkflows/nanoBanana";
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
    // Default to 9:16 (TikTok/Reels) unless explicitly set to 16:9
    const format = scene.episode.format === "16:9" ? "16:9" : "9:16";
    const generator = IMAGE_GENERATORS.find(g => g.id === (generatorId || "dalle3-hd")) || IMAGE_GENERATORS[0];

    const sceneCharNames: string[] = JSON.parse(scene.charactersJson || "[]");

    // Get characters present in this scene WITH their reference photos
    const presentChars = series.characters.filter((c: typeof series.characters[number]) =>
      sceneCharNames.some((sc: string) => sc.toLowerCase().includes(c.name.toLowerCase()))
    );
    const multiCharacterScene = presentChars.length > 1;

    if (multiCharacterScene) {
      const nanoPayload = await buildNanoBananaPayload({
        scene: {
          id: scene.id,
          action: scene.action,
          emotion: scene.emotion,
          camera: scene.camera,
          location: scene.location,
          charactersJson: scene.charactersJson,
        },
        series,
      });

      if (!nanoPayload.ok) {
        return NextResponse.json({
          error: nanoPayload.error,
          recommendedGeneratorId: "nano-banana-pro",
        }, { status: 400 });
      }

      return NextResponse.json({
        error: "Scène multi-personnages détectée. Cette génération est automatiquement réservée à Nano Banana.",
        autoRerouteTo: "nano-banana-pro",
        nanoBananaReady: true,
        recommendedGeneratorId: "nano-banana-pro",
        presentCharacters: presentChars.map((c: typeof presentChars[number]) => c.name),
      }, { status: 400 });
    }

    if (multiCharacterScene && !generator.multiCharacterSafe) {
      return NextResponse.json({
        error: `Le générateur "${generator.name}" n'est pas fiable pour une scène avec plusieurs personnages. Utilisez Nano Banana pour éviter des images aléatoires et des coûts inutiles.`,
        recommendedGeneratorId: "nano-banana-pro",
        presentCharacters: presentChars.map((c: typeof presentChars[number]) => c.name),
      }, { status: 400 });
    }

    // Get matching environment
    const matchedEnv = series.environments.find((e: typeof series.environments[number]) =>
      scene.location?.toLowerCase().includes(e.name.toLowerCase())
    ) || series.environments[0];

    const envPreview = (matchedEnv as typeof matchedEnv & { previewImageUrl?: string | null })?.previewImageUrl;

    // Build reference images list (characters first, then env)
    const refImages: Array<{ type: string; name: string; url: string }> = [
      ...presentChars.filter((c: typeof presentChars[number]) => c.referenceImageUrl).map((c: typeof presentChars[number]) => ({
        type: "character",
        name: c.name,
        url: c.referenceImageUrl!,
      })),
      ...(envPreview ? [{ type: "environment", name: matchedEnv!.name, url: envPreview }] : []),
    ];

    if (multiCharacterScene && generator.multiCharacterSafe && refImages.filter(r => r.type === "character").length < presentChars.length) {
      return NextResponse.json({
        error: `Références personnage insuffisantes pour une scène multi-personnages. Ajoutez une photo de référence pour: ${presentChars.filter((c: typeof presentChars[number]) => !c.referenceImageUrl).map((c: typeof presentChars[number]) => c.name).join(", ")}.`,
        recommendedGeneratorId: "nano-banana-pro",
      }, { status: 400 });
    }

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

      // Priority 2: if has reference photo but no DNA
      if (char.referenceImageUrl) {
        if (generator.supportsImgToImg) {
          // For img2img generators: the photo is passed as image reference (handled below)
          // Still inject text description for prompt
          charDescriptions += `\n[${char.name.toUpperCase()}] (photo reference used): ${char.physicalDescription}. Outfit: ${char.outfit}. `;
          continue;
        } else {
          // For non-img2img (DALL-E etc): use Vision to analyze photo → inject description
          const visionDesc = await describeCharacterFromPhoto(
            char.referenceImageUrl,
            char.name,
            series.visualStyle
          );
          if (visionDesc) {
            charDescriptions += `\n[${char.name.toUpperCase()}] (analyzed from photo): ${visionDesc}. `;
            continue;
          }
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
      // Replicate can return: string, string[], object with toString(), or ReadableStream
      if (Array.isArray(output) && output.length > 0) {
        const first = output[0];
        // Could be a FileOutput object with url() method or toString()
        if (typeof first === "string") {
          imageUrl = first;
        } else if (first && typeof (first as { url?: () => string }).url === "function") {
          imageUrl = (first as { url: () => string }).url();
        } else {
          imageUrl = String(first); // toString() gives the URL
        }
      } else if (typeof output === "string") {
        imageUrl = output;
      } else if (output && typeof (output as { url?: () => string }).url === "function") {
        imageUrl = (output as { url: () => string }).url();
      } else if (output) {
        imageUrl = String(output);
      }
      // Clean up: ensure it's a valid URL
      if (imageUrl && !imageUrl.startsWith("http") && !imageUrl.startsWith("data:")) {
        imageUrl = "";
      }

    } else if (generator.provider === "Fal.ai") {
      const falKey = process.env.FAL_API_KEY;
      if (!falKey) throw new Error("FAL_API_KEY manquante — ajoutez-la dans Paramètres");

      // Fal.ai image_size must be an object {width, height} or predefined preset
      const falImageSize = format === "9:16"
        ? { width: 576, height: 1024 }
        : { width: 1024, height: 576 };

      const falBody: Record<string, unknown> = {
        prompt: prompt.slice(0, 2000),
        image_size: falImageSize,
        num_images: 1,
        enable_safety_checker: false,
        sync_mode: true,
      };

      // Send character reference image for img2img models
      if (generator.supportsImgToImg && refImages.length > 0) {
        const charRef = refImages.find(r => r.type === "character");
        if (charRef) {
          const uri = await toBase64Uri(charRef.url);
          if (uri) {
            falBody.image_url = uri;
            falBody.strength = 0.80;
          }
        }
      }

      const falRes = await fetch(`https://fal.run/${generator.model}`, {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(falBody),
      });
      if (!falRes.ok) {
        const errText = await falRes.text();
        throw new Error(`Fal.ai erreur ${falRes.status}: ${errText.slice(0, 300)}`);
      }
      const falData = await falRes.json();
      imageUrl = falData.images?.[0]?.url || falData.image?.url || "";
      if (!imageUrl) throw new Error(`Fal.ai: pas d'image — réponse: ${JSON.stringify(falData).slice(0, 200)}`);

    } else if (generator.provider === "Together.ai") {
      const togetherKey = process.env.TOGETHER_API_KEY;
      if (!togetherKey) throw new Error("TOGETHER_API_KEY manquante — ajoutez-la dans Paramètres");
      const togetherRes = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: { "Authorization": `Bearer ${togetherKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: generator.model, prompt: prompt.slice(0, 2000), width, height, steps: 4, n: 1 }),
      });
      if (!togetherRes.ok) throw new Error(`Together.ai erreur ${togetherRes.status}: ${await togetherRes.text().then(t => t.slice(0, 200))}`);
      const togetherData = await togetherRes.json();
      imageUrl = togetherData.data?.[0]?.url || "";
      if (!imageUrl) throw new Error("Together.ai: pas d'image générée");

    } else if (generator.provider === "HuggingFace") {
      const hfKey = process.env.HUGGINGFACE_API_KEY;
      if (!hfKey) throw new Error("HUGGINGFACE_API_KEY manquante — ajoutez-la dans Paramètres");
      const hfRes = await fetch(`https://api-inference.huggingface.co/models/${generator.model}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${hfKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: prompt.slice(0, 1500) }),
      });
      if (!hfRes.ok) throw new Error(`HuggingFace erreur ${hfRes.status}: ${await hfRes.text().then(t => t.slice(0, 200))}`);
      const hfBuffer = Buffer.from(await (await hfRes.blob()).arrayBuffer());
      imageUrl = `data:image/jpeg;base64,${hfBuffer.toString("base64")}`;

    } else if (generator.provider === "Stability AI") {
      const stabKey = process.env.STABILITY_API_KEY;
      if (!stabKey) throw new Error("STABILITY_API_KEY manquante — ajoutez-la dans Paramètres");
      const form = new FormData();
      form.append("prompt", prompt.slice(0, 2000));
      form.append("aspect_ratio", format === "9:16" ? "9:16" : "16:9");
      form.append("output_format", "webp");
      const stabRes = await fetch(`https://api.stability.ai/v2beta/${generator.model}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${stabKey}`, "Accept": "image/*" },
        body: form,
      });
      if (!stabRes.ok) throw new Error(`Stability AI erreur ${stabRes.status}: ${await stabRes.text().then(t => t.slice(0, 200))}`);
      const stabBuffer = Buffer.from(await stabRes.arrayBuffer());
      imageUrl = `data:image/webp;base64,${stabBuffer.toString("base64")}`;

    } else {
      // Unknown provider or missing API key — fallback to DALL-E 3 if key available
      if (process.env.OPENAI_API_KEY) {
        const size = format === "9:16" ? "1024x1792" : "1792x1024";
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt.slice(0, 4000),
          n: 1,
          size: size as "1024x1024" | "1024x1792" | "1792x1024",
          quality: "standard",
        });
        imageUrl = (response.data ?? [])[0]?.url || "";
      } else {
        throw new Error(`Générateur "${generator.name}" non supporté ou clé API manquante`);
      }
    }

    if (!imageUrl) throw new Error(`Aucune image générée avec ${generator.name} — vérifiez votre clé API dans Paramètres`);

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
      charactersWithPhoto: presentChars.filter((c: typeof presentChars[number]) => c.referenceImageUrl).map((c: typeof presentChars[number]) => c.name),
      charactersWithDNA: presentChars.filter((c: typeof presentChars[number]) => c.visualDNA).map((c: typeof presentChars[number]) => c.name),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
