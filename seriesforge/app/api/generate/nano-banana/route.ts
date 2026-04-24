/**
 * Nano Banana Pro (Google Imagen 3 / Gemini 3 Pro)
 * 
 * KEY RULES:
 * - inputImageUrls = reference photos of characters (must be PUBLIC https:// URLs)
 * - Local /uploads/ files must be uploaded to fal.ai storage first
 * - Prompt must describe a CINEMATIC SCENE not a portrait
 * - aspectRatio = "9:16" always (TikTok format)
 * - mode "edit" = uses reference images
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";

const NANOBANA_BASE = "https://nanophoto.ai/api/nano-banana-pro";

// Upload local file to fal.ai CDN → get public URL
async function localFileToPublicUrl(localPath: string, falKey: string): Promise<string | null> {
  try {
    const filePath = path.join(process.cwd(), "public", localPath);
    const buffer = await readFile(filePath);
    const ext = localPath.split(".").pop()?.toLowerCase() || "jpg";
    const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    const filename = `char-ref-${Date.now()}.${ext}`;

    const blob = new Blob([buffer], { type: mimeType });
    const formData = new FormData();
    formData.append("file", blob, filename);

    const res = await fetch("https://fal.run/fal-ai/storage/upload", {
      method: "POST",
      headers: { "Authorization": `Key ${falKey}` },
      body: formData,
    });

    if (!res.ok) {
      console.error("Fal storage upload failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.url || null;
  } catch (e) {
    console.error("localFileToPublicUrl error:", e);
    return null;
  }
}

// Get a public URL for any image (local or external)
async function getPublicUrl(imageUrl: string, falKey: string): Promise<string | null> {
  if (!imageUrl) return null;

  // Already public URL
  if (imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) {
    return imageUrl;
  }

  // Local file — upload to fal.ai storage to get public URL
  if (imageUrl.startsWith("/")) {
    return await localFileToPublicUrl(imageUrl, falKey);
  }

  return null;
}

// Poll until completed
async function pollStatus(apiKey: string, generationId: string): Promise<string | null> {
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 4000));

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
      throw new Error(`Génération échouée: ${JSON.stringify(data).slice(0, 200)}`);
    }
  }
  throw new Error("Timeout — génération trop longue (>100s)");
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const nanoBanaKey = process.env.NANOBANA_API_KEY;
    if (!nanoBanaKey) {
      return NextResponse.json({
        error: "NANOBANA_API_KEY manquante — ajoutez-la dans Paramètres → Nano Banana 🍌"
      }, { status: 400 });
    }

    const falKey = process.env.FAL_API_KEY;
    if (!falKey) {
      return NextResponse.json({
        error: "FAL_API_KEY requise pour uploader les photos de référence"
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

    // ALWAYS use 9:16 for TikTok/Reels
    const aspectRatio = "9:16";

    // Get characters in this scene with their photos
    const sceneCharNames: string[] = JSON.parse(scene.charactersJson || "[]");
    const presentChars = series.characters.filter(c =>
      sceneCharNames.some(sc => sc.toLowerCase().includes(c.name.toLowerCase()))
    );
    const charsWithPhoto = presentChars.filter(c => c.referenceImageUrl);

    // Upload all reference photos to get public URLs
    const inputImageUrls: string[] = [];
    const uploadedChars: string[] = [];

    for (const char of charsWithPhoto) {
      if (inputImageUrls.length >= 7) break; // keep 1 slot for environment
      const url = await getPublicUrl(char.referenceImageUrl!, falKey);
      if (url) {
        inputImageUrls.push(url);
        uploadedChars.push(char.name);
      }
    }

    // Add environment reference if available
    const matchedEnv = series.environments.find(e =>
      scene.location?.toLowerCase().includes(e.name.toLowerCase())
    ) || series.environments[0];

    const envPreview = (matchedEnv as typeof matchedEnv & { previewImageUrl?: string | null })?.previewImageUrl;
    if (envPreview && inputImageUrls.length < 8) {
      const url = await getPublicUrl(envPreview, falKey);
      if (url) inputImageUrls.push(url);
    }

    // Build CINEMATIC SCENE prompt — not a portrait
    const envDesc = matchedEnv
      ? `${matchedEnv.name} — ${matchedEnv.description}${matchedEnv.lighting ? `. Lighting: ${matchedEnv.lighting}` : ""}${matchedEnv.mood ? `. Mood: ${matchedEnv.mood}` : ""}`
      : scene.location || "outdoor location";

    // Character descriptions from DNA or text
    const charLines = presentChars.map(c => {
      const dna = c.visualDNA ? (() => { try { return JSON.parse(c.visualDNA!); } catch { return null; } })() : null;
      const photoNote = charsWithPhoto.some(ch => ch.id === c.id) ? " [REPRODUCE EXACT FACE FROM REFERENCE PHOTO]" : "";
      if (dna?.lockedPrompt) return `${c.name}${photoNote}: ${dna.lockedPrompt}`;
      return `${c.name}${photoNote}: ${c.physicalDescription}. Outfit: ${c.outfit}.`;
    }).join("\n");

    // CINEMATIC PROMPT — emphasis on scene action, movement, environment
    const prompt = `${series.visualStyle}, vertical 9:16 portrait format, cinematic animated scene.

SCENE ACTION: ${scene.action || "dramatic cinematic moment with character movement"}

SETTING: ${envDesc}

CHARACTERS IN THIS SCENE (reproduce exact appearance from reference photos):
${charLines}

CAMERA: ${scene.camera || "dynamic medium shot with slight motion blur"}
EMOTION/ATMOSPHERE: ${scene.emotion || "intense, dramatic"}
LIGHTING: ${matchedEnv?.lighting || "cinematic dramatic lighting"}

COMPOSITION RULES:
- Vertical 9:16 format, full scene composition
- Characters in action, NOT posing for portrait
- Characters are INSIDE the scene environment, not on white background
- Show environment context (floor, sky, surroundings)
- Dynamic pose, movement, gestures matching the scene action
- ${series.visualStyle} quality: cinematic, detailed, expressive
- Same character appearance as reference photos provided

STYLE: ${series.visualStyle}, high quality animation render, vibrant colors, professional composition`;

    const mode = inputImageUrls.length > 0 ? "edit" : "generate";

    const body: Record<string, unknown> = {
      prompt: prompt.slice(0, 1500),
      mode,
      aspectRatio,
      imageQuality: "2K",
    };

    if (mode === "edit" && inputImageUrls.length > 0) {
      body.inputImageUrls = inputImageUrls;
    }

    // Submit to Nano Banana Pro
    const genRes = await fetch(`${NANOBANA_BASE}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nanoBanaKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!genRes.ok) {
      const err = await genRes.text();
      throw new Error(`Nano Banana Pro ${genRes.status}: ${err.slice(0, 400)}`);
    }

    const genData = await genRes.json();
    const generationId = genData.generationId || genData.data?.generationId;

    if (!generationId) {
      throw new Error(`Pas de generationId: ${JSON.stringify(genData).slice(0, 200)}`);
    }

    // Poll for result
    const imageUrl = await pollStatus(nanoBanaKey, generationId);
    if (!imageUrl) throw new Error("Pas d'image dans le résultat");

    // Save to history
    const currentScene = await prisma.scene.findUnique({
      where: { id: sceneId },
      select: { imageUrl: true, imageHistory: true },
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
      referencesUploaded: uploadedChars,
      totalRefs: inputImageUrls.length,
      charsWithoutPhoto: presentChars.filter(c => !charsWithPhoto.some(cp => cp.id === c.id)).map(c => c.name),
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Génération échouée";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
