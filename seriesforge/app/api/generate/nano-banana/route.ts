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
import { tryEnsureDurableImageUrl } from "@/lib/storage/durableImages";
import { resolveSceneCharacterReferences } from "@/lib/imageWorkflows/nanoBanana";
import { persistSceneImageWithHistory } from "@/lib/storage/sceneImages";
import { getCharacterGroupAssets, matchGroupAssetsForScene } from "@/lib/groups/characterGroups";
import {
  buildSceneReferencePromptBlock,
  getSceneReferenceAssets,
} from "@/lib/scenes/sceneReferenceAssets";

const NANOBANA_BASE = "https://nanophoto.ai/api/nano-banana-pro";

// Get a durable public URL for any image (local or external)
async function getPublicUrl(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;

  return tryEnsureDurableImageUrl(imageUrl, {
    folder: "references",
    fileNamePrefix: `nano-ref-${Date.now()}`,
    forceRehostRemote: true,
  });
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
            series: { include: { characters: true, environments: true, assets: true } },
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
    const presentChars = series.characters.filter((c: typeof series.characters[number]) =>
      sceneCharNames.some((sc: string) => sc.toLowerCase().includes(c.name.toLowerCase()))
    );

    const resolvedReferences = await resolveSceneCharacterReferences({
      presentChars,
      maxImages: 7,
    });
    const inputImageUrls = [...resolvedReferences.inputImageUrls];
    const uploadedChars = resolvedReferences.uploadedChars;
    const rawReadableChars = resolvedReferences.assignedButInvalid;
    const missingCharacterRefs = [...resolvedReferences.missingRefs];

    if (presentChars.length > 1 && uploadedChars.length + rawReadableChars.length < presentChars.length) {
      return NextResponse.json({
        error: `Références insuffisantes pour une scène multi-personnages. Photos valides: ${[...uploadedChars, ...rawReadableChars].join(", ") || "aucune"} · manquantes: ${missingCharacterRefs.join(", ")}`,
      }, { status: 400 });
    }

    // Add environment reference if available
    const matchedEnv = series.environments.find((e: typeof series.environments[number]) =>
      scene.location?.toLowerCase().includes(e.name.toLowerCase())
    ) || series.environments[0];

    const envPreview = (matchedEnv as typeof matchedEnv & { previewImageUrl?: string | null })?.previewImageUrl;
    if (envPreview && inputImageUrls.length < 8) {
      const url = await getPublicUrl(envPreview);
      if (url) inputImageUrls.push(url);
    }

    const matchedGroups = matchGroupAssetsForScene({
      groups: getCharacterGroupAssets(series.assets || []),
      sceneCharacters: sceneCharNames,
      sceneText: [scene.location, scene.action, scene.narration, scene.dialogue].filter(Boolean).join(" "),
    }).slice(0, 2);
    const manualSceneReferences = getSceneReferenceAssets(series.assets || [], scene.id)
      .filter((reference) => Boolean(reference.url))
      .slice(0, 4);

    for (const group of matchedGroups) {
      if (group.url && inputImageUrls.length < 8) {
        const url = await getPublicUrl(group.url);
        if (url) inputImageUrls.push(url);
      }
    }

    for (const reference of manualSceneReferences) {
      if (reference.url && inputImageUrls.length < 8) {
        const url = await getPublicUrl(reference.url);
        if (url) inputImageUrls.push(url);
      }
    }

    // Build CINEMATIC SCENE prompt — not a portrait
    const envDesc = matchedEnv
      ? `${matchedEnv.name} — ${matchedEnv.description}${matchedEnv.lighting ? `. Lighting: ${matchedEnv.lighting}` : ""}${matchedEnv.mood ? `. Mood: ${matchedEnv.mood}` : ""}`
      : scene.location || "outdoor location";

    // Character descriptions from DNA or text
    const charLines = presentChars.map((c: typeof presentChars[number]) => {
      const dna = c.visualDNA ? (() => { try { return JSON.parse(c.visualDNA!); } catch { return null; } })() : null;
      const photoNote = uploadedChars.includes(c.name) || rawReadableChars.includes(c.name)
        ? " [REPRODUCE EXACT FACE FROM REFERENCE PHOTO]"
        : "";
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
    const groupReferenceBlock = matchedGroups.length > 0
      ? `\nGROUP REFERENCES: ${matchedGroups.map((group) => `${group.name} (${group.metadata.category})`).join(" | ")}. Preserve the same team or family composition shown in these group images when the scene calls for it.`
      : "";
    const manualReferenceBlock = buildSceneReferencePromptBlock(manualSceneReferences);
    const finalPrompt = `${prompt}${groupReferenceBlock}${manualReferenceBlock ? `\n${manualReferenceBlock}` : ""}`;

    const mode = inputImageUrls.length > 0 ? "edit" : "generate";

    if (presentChars.length > 0 && mode !== "edit") {
      return NextResponse.json({
        error: "Impossible de lancer la génération sans références image valides pour les personnages de cette scène.",
      }, { status: 400 });
    }

    const body: Record<string, unknown> = {
      prompt: finalPrompt.slice(0, 1500),
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

    const durableImageUrl = await persistSceneImageWithHistory({
      sceneId,
      imageUrl,
      generatorName: "Nano Banana Pro",
    });

    return NextResponse.json({
      imageUrl: durableImageUrl,
      sceneId,
      generator: "Nano Banana Pro",
      mode,
      referencesUploaded: [...uploadedChars, ...rawReadableChars],
      totalRefs: inputImageUrls.length,
      charsWithoutPhoto: missingCharacterRefs,
      charsMissingValidRef: missingCharacterRefs,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Génération échouée";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
