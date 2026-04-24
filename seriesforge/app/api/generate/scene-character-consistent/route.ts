/**
 * Scene generation WITH real character photo reference
 * Uses models specifically designed for character consistency:
 * - fal-ai/ideogram/character (reference_image_urls)
 * - fal-ai/instant-character (image_url)
 * - fal-ai/minimax/image-01/subject-reference (image_url)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";

// Convert local path to publicly accessible URL or base64
async function getImageForFal(imageUrl: string, baseUrl: string): Promise<string | null> {
  try {
    // External URL — use directly
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      return imageUrl;
    }
    // Local file — convert to base64 data URI (Fal.ai accepts these)
    if (imageUrl.startsWith("/")) {
      const filePath = path.join(process.cwd(), "public", imageUrl);
      const buffer = await readFile(filePath);
      const ext = imageUrl.split(".").pop()?.toLowerCase() || "jpg";
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      return `data:${mime};base64,${buffer.toString("base64")}`;
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

    const { sceneId, model = "ideogram-character" } = await req.json();

    const falKey = process.env.FAL_API_KEY;
    if (!falKey) return NextResponse.json({ error: "FAL_API_KEY manquante — ajoutez-la dans Paramètres" }, { status: 400 });

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

    if (!scene) return NextResponse.json({ error: "Scène non trouvée" }, { status: 404 });

    const { series } = scene.episode;
    // Default to 9:16 (TikTok/Reels) unless explicitly set to 16:9
    const format = scene.episode.format === "16:9" ? "16:9" : "9:16";

    // Get characters in this scene with their reference photos
    const sceneCharNames: string[] = JSON.parse(scene.charactersJson || "[]");
    const presentChars = series.characters.filter(c =>
      sceneCharNames.some(sc => sc.toLowerCase().includes(c.name.toLowerCase()))
    );
    const charsWithPhoto = presentChars.filter(c => c.referenceImageUrl);

    // Get environment
    const matchedEnv = series.environments.find(e =>
      scene.location?.toLowerCase().includes(e.name.toLowerCase())
    ) || series.environments[0];

    // Build scene description prompt
    const charNames = presentChars.map(c => c.name).join(", ");
    const envDesc = matchedEnv
      ? `${matchedEnv.name} — ${matchedEnv.description}${matchedEnv.lighting ? `. ${matchedEnv.lighting}` : ""}${matchedEnv.mood ? `. ${matchedEnv.mood}` : ""}`
      : scene.location || "outdoor scene";

    const scenePrompt = `${series.visualStyle} animated scene, ${format} format.
${charNames ? `Characters: ${charNames}.` : ""}
Location: ${envDesc}.
Action: ${scene.action || "dramatic moment"}.
Emotion: ${scene.emotion || "neutral"}.
Camera: ${scene.camera || "medium shot"}.
Style: ${series.visualStyle}, high quality, cinematic lighting, same character visual identity.`;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    let imageUrl = "";
    let modelUsed = "";
    let refImagesUsed: string[] = [];

    // Get first character's photo as primary reference
    const primaryChar = charsWithPhoto[0];
    const primaryRefUrl = primaryChar?.referenceImageUrl
      ? await getImageForFal(primaryChar.referenceImageUrl, baseUrl)
      : null;

    if (model === "ideogram-character" && primaryRefUrl) {
      // fal-ai/ideogram/character — best for character face consistency
      modelUsed = "Ideogram Character";
      const body: Record<string, unknown> = {
        prompt: scenePrompt.slice(0, 1500),
        reference_image_urls: [primaryRefUrl],
        image_size: format === "9:16" ? "portrait_16_9" : "landscape_16_9",
        num_images: 1,
        rendering_speed: "BALANCED",
        style_type: "AUTO",
        magic_prompt: false,
      };

      const res = await fetch("https://fal.run/fal-ai/ideogram/character", {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Ideogram Character erreur ${res.status}: ${err.slice(0, 300)}`);
      }

      const data = await res.json();
      imageUrl = data.images?.[0]?.url || data.image?.url || "";
      refImagesUsed = charsWithPhoto.map(c => c.name);

    } else if (model === "instant-character" && primaryRefUrl) {
      // fal-ai/instant-character — strong identity control
      modelUsed = "Instant Character";
      const imgSize = format === "9:16"
        ? { width: 576, height: 1024 }
        : { width: 1024, height: 576 };

      const body = {
        prompt: scenePrompt.slice(0, 1500),
        image_url: primaryRefUrl,
        image_size: imgSize,
        num_images: 1,
        guidance_scale: 3.5,
        num_inference_steps: 28,
        sync_mode: true,
        enable_safety_checker: false,
      };

      const res = await fetch("https://fal.run/fal-ai/instant-character", {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Instant Character erreur ${res.status}: ${err.slice(0, 300)}`);
      }

      const data = await res.json();
      imageUrl = data.images?.[0]?.url || data.image?.url || "";
      refImagesUsed = charsWithPhoto.map(c => c.name);

    } else if (model === "minimax-subject" && primaryRefUrl) {
      // fal-ai/minimax/image-01/subject-reference
      modelUsed = "MiniMax Subject Reference";
      const body = {
        prompt: scenePrompt.slice(0, 1500),
        image_url: primaryRefUrl,
        aspect_ratio: format === "9:16" ? "9:16" : "16:9",
        num_images: 1,
        prompt_optimizer: false,
      };

      const res = await fetch("https://fal.run/fal-ai/minimax/image-01/subject-reference", {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`MiniMax Subject erreur ${res.status}: ${err.slice(0, 300)}`);
      }

      const data = await res.json();
      imageUrl = data.images?.[0]?.url || data.image?.url || "";
      refImagesUsed = [primaryChar?.name || ""];

    } else {
      // No photo available or unknown model — fallback to FLUX Schnell with text prompt
      modelUsed = "FLUX Schnell (pas de photo)";
      const imgSize = format === "9:16" ? { width: 576, height: 1024 } : { width: 1024, height: 576 };
      const body = {
        prompt: scenePrompt.slice(0, 2000),
        image_size: imgSize,
        num_images: 1,
        sync_mode: true,
        enable_safety_checker: false,
      };

      const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`FLUX Schnell erreur ${res.status}: ${err.slice(0, 300)}`);
      }

      const data = await res.json();
      imageUrl = data.images?.[0]?.url || data.image?.url || "";
    }

    if (!imageUrl) throw new Error(`Aucune image générée avec ${modelUsed}`);

    // Save history
    const currentScene = await prisma.scene.findUnique({ where: { id: sceneId }, select: { imageUrl: true, imageHistory: true } });
    let history: Array<{ url: string; generator: string; createdAt: string }> = [];
    try { history = JSON.parse(currentScene?.imageHistory || "[]"); } catch {}
    if (currentScene?.imageUrl) {
      history.unshift({ url: currentScene.imageUrl, generator: modelUsed, createdAt: new Date().toISOString() });
      if (history.length > 10) history = history.slice(0, 10);
    }

    await prisma.scene.update({
      where: { id: sceneId },
      data: { imageUrl, imageHistory: JSON.stringify(history) },
    });

    return NextResponse.json({
      imageUrl,
      sceneId,
      modelUsed,
      refImagesUsed,
      charsWithPhoto: charsWithPhoto.map(c => c.name),
      charsWithoutPhoto: presentChars.filter(c => !c.referenceImageUrl).map(c => c.name),
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Génération échouée";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
