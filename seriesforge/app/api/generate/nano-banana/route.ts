/**
 * Nano Banana Pro (Google Imagen 3 / Gemini 3 Pro Image)
 * API: nanophoto.ai
 * Supports up to 8 reference images for character consistency (95%+)
 * 
 * Workflow:
 * 1. POST /api/nano-banana-pro/generate → returns generationId
 * 2. Poll POST /api/nano-banana-pro/check-status every 3-5s until completed
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";

const NANOBANA_BASE = "https://nanophoto.ai/api/nano-banana-pro";

async function imageToPublicUrl(imageUrl: string): Promise<string | null> {
  try {
    // External URL — use directly (required by Nano Banana API — no base64 support)
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      return imageUrl;
    }
    // Local file — we need to upload it or use a data URI
    // Nano Banana only accepts public URLs, not base64
    // For local files, return null (will skip that reference)
    // TODO: when deployed, use the public URL instead
    return null;
  } catch {
    return null;
  }
}

async function pollStatus(apiKey: string, generationId: string, maxAttempts = 20): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 4000)); // wait 4s between polls

    const res = await fetch(`${NANOBANA_BASE}/check-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ generationId }),
    });

    if (!res.ok) continue;

    const data = await res.json();
    const status = data.status || data.data?.status;

    if (status === "completed" || status === "success") {
      return data.imageUrl || data.data?.imageUrl || data.result?.imageUrl || null;
    }
    if (status === "failed" || status === "error") {
      throw new Error(`Nano Banana generation failed: ${JSON.stringify(data)}`);
    }
    // Still pending/generating — continue polling
  }
  throw new Error("Nano Banana timeout — génération trop longue");
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = process.env.NANOBANA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: "NANOBANA_API_KEY manquante — ajoutez votre clé Nano Banana Pro dans Paramètres"
      }, { status: 400 });
    }

    const { sceneId } = await req.json();

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
    const format = scene.episode.format;

    // Get characters in this scene
    const sceneCharNames: string[] = JSON.parse(scene.charactersJson || "[]");
    const presentChars = series.characters.filter(c =>
      sceneCharNames.some(sc => sc.toLowerCase().includes(c.name.toLowerCase()))
    );

    // Get environment
    const matchedEnv = series.environments.find(e =>
      scene.location?.toLowerCase().includes(e.name.toLowerCase())
    ) || series.environments[0];

    // Collect reference image URLs (max 8 for Nano Banana Pro)
    // Priority: character reference photos first, then environment
    const inputImageUrls: string[] = [];

    for (const char of presentChars) {
      if (char.referenceImageUrl && inputImageUrls.length < 7) {
        const url = await imageToPublicUrl(char.referenceImageUrl);
        if (url) inputImageUrls.push(url);
      }
    }

    const envPreviewUrl = (matchedEnv as typeof matchedEnv & { previewImageUrl?: string | null })?.previewImageUrl;
    if (envPreviewUrl && inputImageUrls.length < 8) {
      const url = await imageToPublicUrl(envPreviewUrl);
      if (url) inputImageUrls.push(url);
    }

    // Build the prompt — ultra detailed for Nano Banana Pro
    const envDesc = matchedEnv
      ? `${matchedEnv.name}: ${matchedEnv.description}${matchedEnv.lighting ? `. ${matchedEnv.lighting}` : ""}${matchedEnv.mood ? `. Mood: ${matchedEnv.mood}` : ""}`
      : scene.location || "outdoor scene";

    const charDesc = presentChars.map(c => {
      const dna = c.visualDNA ? (() => { try { return JSON.parse(c.visualDNA!); } catch { return null; } })() : null;
      if (dna?.lockedPrompt) return `${c.name}: ${dna.lockedPrompt}`;
      return `${c.name}: ${c.physicalDescription}. Outfit: ${c.outfit}.`;
    }).join("\n");

    const prompt = `${series.visualStyle} animated scene, ${format} format.

CHARACTERS (maintain exact appearance from reference photos):
${charDesc}

LOCATION: ${envDesc}

ACTION: ${scene.action || "dramatic moment"}
EMOTION: ${scene.emotion || "neutral"}
CAMERA: ${scene.camera || "medium shot"}

Style requirements: ${series.visualStyle}, cinematic lighting, high quality animation render, same character visual identity as reference images. Ultra detailed. High quality.`;

    const mode = inputImageUrls.length > 0 ? "edit" : "generate";
    // Force 9:16 for TikTok/Reels format by default, unless episode is explicitly 16:9
    const aspectRatio = format === "16:9" ? "16:9" : "9:16";

    // Step 1: Submit generation
    const body: Record<string, unknown> = {
      prompt: prompt.slice(0, 1500),
      mode,
      aspectRatio,
      imageQuality: "2K",
    };

    if (mode === "edit" && inputImageUrls.length > 0) {
      body.inputImageUrls = inputImageUrls;
    }

    const genRes = await fetch(`${NANOBANA_BASE}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!genRes.ok) {
      const err = await genRes.text();
      throw new Error(`Nano Banana Pro erreur ${genRes.status}: ${err.slice(0, 300)}`);
    }

    const genData = await genRes.json();
    const generationId = genData.generationId || genData.data?.generationId;

    if (!generationId) {
      throw new Error(`Nano Banana Pro: pas de generationId — ${JSON.stringify(genData).slice(0, 200)}`);
    }

    // Step 2: Poll for result
    const imageUrl = await pollStatus(apiKey, generationId);

    if (!imageUrl) throw new Error("Nano Banana Pro: pas d'image dans le résultat");

    // Save history
    const currentScene = await prisma.scene.findUnique({
      where: { id: sceneId },
      select: { imageUrl: true, imageHistory: true }
    });
    let history: Array<{ url: string; generator: string; createdAt: string }> = [];
    try { history = JSON.parse(currentScene?.imageHistory || "[]"); } catch {}
    if (currentScene?.imageUrl) {
      history.unshift({ url: currentScene.imageUrl, generator: "Nano Banana Pro", createdAt: new Date().toISOString() });
      if (history.length > 10) history = history.slice(0, 10);
    }

    await prisma.scene.update({
      where: { id: sceneId },
      data: { imageUrl, imageHistory: JSON.stringify(history) },
    });

    return NextResponse.json({
      imageUrl,
      sceneId,
      generator: "Nano Banana Pro",
      mode,
      refImagesUsed: presentChars.filter(c => c.referenceImageUrl).map(c => c.name),
      inputImageCount: inputImageUrls.length,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Génération échouée";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
