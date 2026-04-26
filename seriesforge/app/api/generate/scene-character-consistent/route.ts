/**
 * Scene generation with character reference photos
 * Uses: Ideogram Character, Instant Character, MiniMax Subject Reference
 * Local photos are uploaded to fal.ai CDN first to get public URLs
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";
import { generateSceneWithNanoBanana } from "@/lib/imageWorkflows/nanoBanana";
import { resolveSceneCharacterReferences } from "@/lib/imageWorkflows/nanoBanana";
import { persistSceneImageResult } from "@/lib/storage/sceneImages";
import { getCharacterGroupAssets, matchGroupAssetsForScene } from "@/lib/groups/characterGroups";
import {
  buildSceneReferencePromptBlock,
  getSceneReferenceAssets,
} from "@/lib/scenes/sceneReferenceAssets";

type SeriesCharacter = {
  id: string;
  name: string;
  physicalDescription: string;
  outfit: string;
  visualDNA: string | null;
  referenceImageUrl: string | null;
};

type SeriesEnvironment = {
  name: string;
  description: string;
  lighting: string | null;
  mood: string | null;
};
import { tryEnsureDurableImageUrl } from "@/lib/storage/durableImages";

async function toPublicUrl(imageUrl: string, falKey: string): Promise<string | null> {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) {
    return tryEnsureDurableImageUrl(imageUrl, {
      folder: "references",
      fileNamePrefix: `scene-ref-${Date.now()}`,
      forceRehostRemote: true,
    });
  }
  if (!imageUrl.startsWith("/")) return null;

  try {
    const filePath = path.join(process.cwd(), "public", imageUrl);
    const buffer = await readFile(filePath);
    const ext = imageUrl.split(".").pop()?.toLowerCase() || "jpg";
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    // Upload to fal.ai storage → public URL
    const blob = new Blob([buffer], { type: mime });
    const formData = new FormData();
    formData.append("file", blob, `ref-${Date.now()}.${ext}`);

    const res = await fetch("https://fal.run/fal-ai/storage/upload", {
      method: "POST",
      headers: { "Authorization": `Key ${falKey}` },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.url) return data.url;
    }

    // Fallback: base64 (fal models accept this)
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function buildScenePrompt(params: {
  action: string;
  envDesc: string;
  emotion: string;
  camera: string;
  charLines: string;
  visualStyle: string;
}): string {
  const { action, envDesc, emotion, camera, charLines, visualStyle } = params;
  return `${visualStyle}, vertical 9:16 portrait format, cinematic animated scene.

SCENE IN ACTION: ${action}

SETTING: ${envDesc}

CHARACTERS (reproduce from reference photos):
${charLines}

CAMERA: ${camera || "dynamic medium shot"}
ATMOSPHERE: ${emotion || "dramatic, intense"}

COMPOSITION:
- Vertical 9:16 portrait format
- Characters INSIDE the scene, doing the action described
- NOT a portrait or static pose — show movement and action
- Full environment visible (floor, sky, background)
- ${visualStyle} quality animation render
- Same appearance as reference photos`;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sceneId, model = "ideogram-character" } = await req.json();

    const falKey = process.env.FAL_API_KEY;
    if (!falKey) return NextResponse.json({ error: "FAL_API_KEY manquante — Paramètres" }, { status: 400 });

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
    const groupAssets = getCharacterGroupAssets(series.assets || []);

    const sceneCharNames: string[] = JSON.parse(scene.charactersJson || "[]");
    const presentChars = series.characters.filter((c: SeriesCharacter & {
      faceReferenceImages?: unknown;
      fullBodyReferenceImages?: unknown;
    }) =>
      sceneCharNames.some(sc => sc.toLowerCase().includes(c.name.toLowerCase()))
    );
    const resolvedReferences = await resolveSceneCharacterReferences({
      presentChars,
      maxImages: 4,
    });
    const charsWithPhoto = presentChars.filter((c: typeof presentChars[number]) =>
      resolvedReferences.uploadedChars.includes(c.name)
    );

    if (presentChars.length > 1) {
      return NextResponse.json(await generateSceneWithNanoBanana({
        sceneId,
        userId: user.id,
        model: "nano-banana-pro",
        autoRouted: true,
      }));
    }

    const matchedEnv = series.environments.find((e: SeriesEnvironment) =>
      scene.location?.toLowerCase().includes(e.name.toLowerCase())
    ) || series.environments[0];
    const matchedGroups = matchGroupAssetsForScene({
      groups: groupAssets,
      sceneCharacters: sceneCharNames,
      sceneText: [scene.location, scene.action, scene.narration, scene.dialogue].filter(Boolean).join(" "),
    }).slice(0, 2);
    const manualSceneReferences = getSceneReferenceAssets(series.assets || [], scene.id)
      .filter((reference) => Boolean(reference.url))
      .slice(0, 4);

    const envDesc = matchedEnv
      ? `${matchedEnv.name} — ${matchedEnv.description}${matchedEnv.lighting ? `. ${matchedEnv.lighting}` : ""}${matchedEnv.mood ? `. ${matchedEnv.mood}` : ""}`
      : scene.location || "outdoor scene";

    const charLines = presentChars.map((c: SeriesCharacter) => {
      const dna = c.visualDNA ? (() => { try { return JSON.parse(c.visualDNA!); } catch { return null; } })() : null;
      const hasPhoto = charsWithPhoto.some((cp: SeriesCharacter) => cp.id === c.id);
      const photoTag = hasPhoto ? " [USE REFERENCE PHOTO]" : "";
      if (dna?.lockedPrompt) return `${c.name}${photoTag}: ${dna.lockedPrompt}`;
      return `${c.name}${photoTag}: ${c.physicalDescription}. Outfit: ${c.outfit}.`;
    }).join("\n");
    const groupLines = matchedGroups.length > 0
      ? `\nGROUP REFERENCES:\n${matchedGroups.map((group) => `${group.name} (${group.metadata.category}) — members: ${group.metadata.members.join(", ")}`).join("\n")}`
      : "";
    const manualReferenceBlock = buildSceneReferencePromptBlock(manualSceneReferences);

    const prompt = buildScenePrompt({
      action: scene.action || "dramatic cinematic moment",
      envDesc,
      emotion: scene.emotion || "dramatic",
      camera: scene.camera || "medium shot",
      charLines: `${charLines}${groupLines}${manualReferenceBlock ? `\n${manualReferenceBlock}` : ""}`,
      visualStyle: series.visualStyle,
    });

    // Get the strongest available reference image and optional extra refs
    const primaryChar = charsWithPhoto[0];
    const primaryRefUrl = resolvedReferences.inputImageUrls[0] || null;
    const extraReferenceUrls = resolvedReferences.inputImageUrls.slice(1, 4);

    let imageUrl = "";
    let modelUsed = "";
    let refImagesUsed: string[] = [];

    if (model === "ideogram-character" && primaryRefUrl) {
      modelUsed = "Ideogram Character";
      const res = await fetch("https://fal.run/fal-ai/ideogram/character", {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.slice(0, 1500),
          reference_image_urls: [primaryRefUrl, ...extraReferenceUrls],
          image_size: "portrait_16_9",
          num_images: 1,
          rendering_speed: "BALANCED",
          magic_prompt: false,
        }),
      });
      if (!res.ok) throw new Error(`Ideogram Character ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      imageUrl = data.images?.[0]?.url || "";
      refImagesUsed = resolvedReferences.uploadedChars;

    } else if (model === "instant-character" && primaryRefUrl) {
      modelUsed = "Instant Character";
      const res = await fetch("https://fal.run/fal-ai/instant-character", {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.slice(0, 1500),
          image_url: primaryRefUrl,
          image_size: { width: 576, height: 1024 },
          num_images: 1,
          guidance_scale: 3.5,
          num_inference_steps: 28,
          sync_mode: true,
          enable_safety_checker: false,
        }),
      });
      if (!res.ok) throw new Error(`Instant Character ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      imageUrl = data.images?.[0]?.url || "";
      refImagesUsed = resolvedReferences.uploadedChars;

    } else if (model === "minimax-subject" && primaryRefUrl) {
      modelUsed = "MiniMax Subject Reference";
      const res = await fetch("https://fal.run/fal-ai/minimax/image-01/subject-reference", {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.slice(0, 1500),
          image_url: primaryRefUrl,
          aspect_ratio: "9:16",
          num_images: 1,
          prompt_optimizer: false,
        }),
      });
      if (!res.ok) throw new Error(`MiniMax Subject ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      imageUrl = data.images?.[0]?.url || "";
      refImagesUsed = resolvedReferences.uploadedChars;

    } else {
      // Fallback: FLUX Schnell (no reference)
      modelUsed = "FLUX Schnell (sans photo)";
      const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.slice(0, 2000),
          image_size: { width: 576, height: 1024 },
          num_images: 1,
          sync_mode: true,
          enable_safety_checker: false,
        }),
      });
      if (!res.ok) throw new Error(`FLUX Schnell ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      imageUrl = data.images?.[0]?.url || "";
    }

    if (!imageUrl) throw new Error(`Aucune image générée avec ${modelUsed}`);
    const durableImageUrl = await persistSceneImageResult({
      sceneId,
      imageUrl,
      generatorName: modelUsed,
    });

    return NextResponse.json({
      imageUrl: durableImageUrl, sceneId, modelUsed, refImagesUsed,
      charsWithPhoto: charsWithPhoto.map((c: SeriesCharacter) => c.name),
      charsWithoutPhoto: presentChars.filter((c: SeriesCharacter) => !charsWithPhoto.some((cp: SeriesCharacter) => cp.id === c.id)).map((c: SeriesCharacter) => c.name),
    });

  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur" }, { status: 500 });
  }
}
