import { prisma } from "@/lib/db/prisma";
import { tryEnsureDurableImageUrl } from "@/lib/storage/durableImages";

const NANOBANA_BASE = "https://nanophoto.ai/api/nano-banana-pro";

type SceneCharacter = {
  id: string;
  name: string;
  physicalDescription: string;
  outfit: string;
  visualDNA: string | null;
  referenceImageUrl: string | null;
};

type SceneEnvironment = {
  name: string;
  description: string;
  lighting: string | null;
  mood: string | null;
  previewImageUrl?: string | null;
};

export interface NanoBananaResult {
  imageUrl: string;
  sceneId: string;
  generator: string;
  mode: "edit" | "generate";
  referencesUploaded: string[];
  totalRefs: number;
  charsWithoutPhoto: string[];
  charsMissingValidRef: string[];
  environmentName?: string;
  autoRouted?: boolean;
}

async function getPublicUrl(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;
  return tryEnsureDurableImageUrl(imageUrl, {
    folder: "references",
    fileNamePrefix: `nano-ref-${Date.now()}`,
    forceRehostRemote: true,
  });
}

async function pollStatus(apiKey: string, generationId: string): Promise<string | null> {
  for (let i = 0; i < 25; i++) {
    await new Promise((resolve) => setTimeout(resolve, 4000));

    const res = await fetch(`${NANOBANA_BASE}/check-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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

export async function generateSceneWithNanoBanana(params: {
  sceneId: string;
  userId: string;
  model?: "nano-banana-pro" | "nano-banana";
  autoRouted?: boolean;
}): Promise<NanoBananaResult> {
  const { sceneId, userId, model = "nano-banana-pro", autoRouted = false } = params;

  const nanoBanaKey = process.env.NANOBANA_API_KEY;
  if (!nanoBanaKey) {
    throw new Error("NANOBANA_API_KEY manquante — ajoutez-la dans Paramètres → Nano Banana 🍌");
  }

  const falKey = process.env.FAL_API_KEY;
  if (!falKey) {
    throw new Error("FAL_API_KEY requise pour uploader les photos de référence");
  }

  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, episode: { series: { userId } } },
    include: {
      episode: {
        include: {
          series: { include: { characters: true, environments: true } },
        },
      },
    },
  });

  if (!scene) throw new Error("Scène non trouvée");

  const { series } = scene.episode;
  const aspectRatio = "9:16";
  const sceneCharNames: string[] = JSON.parse(scene.charactersJson || "[]");
  const presentChars = series.characters.filter((c: SceneCharacter) =>
    sceneCharNames.some((sc: string) => sc.toLowerCase().includes(c.name.toLowerCase()))
  );
  const charsWithPhoto = presentChars.filter((c: SceneCharacter) => c.referenceImageUrl);

  const inputImageUrls: string[] = [];
  const uploadedChars: string[] = [];

  for (const char of charsWithPhoto) {
    if (inputImageUrls.length >= 7) break;
    const url = await getPublicUrl(char.referenceImageUrl!);
    if (url) {
      inputImageUrls.push(url);
      uploadedChars.push(char.name);
    }
  }

  const missingCharacterRefs = presentChars
    .filter((char: SceneCharacter) => !uploadedChars.includes(char.name))
    .map((char: SceneCharacter) => char.name);

  if (presentChars.length > 1 && uploadedChars.length < presentChars.length) {
    throw new Error(
      `Références insuffisantes pour une scène multi-personnages. Photos valides: ${uploadedChars.join(", ") || "aucune"} · manquantes: ${missingCharacterRefs.join(", ")}`
    );
  }

  const matchedEnv = series.environments.find((e: SceneEnvironment) =>
    scene.location?.toLowerCase().includes(e.name.toLowerCase())
  ) || series.environments[0];

  const envPreview = (matchedEnv as SceneEnvironment & { previewImageUrl?: string | null }).previewImageUrl;
  if (envPreview && inputImageUrls.length < 8) {
    const envUrl = await getPublicUrl(envPreview);
    if (envUrl) inputImageUrls.push(envUrl);
  }

  const envDesc = matchedEnv
    ? `${matchedEnv.name} — ${matchedEnv.description}${matchedEnv.lighting ? `. Lighting: ${matchedEnv.lighting}` : ""}${matchedEnv.mood ? `. Mood: ${matchedEnv.mood}` : ""}`
    : scene.location || "outdoor location";

  const charLines = presentChars.map((char: SceneCharacter) => {
    const dna = char.visualDNA ? (() => { try { return JSON.parse(char.visualDNA!); } catch { return null; } })() : null;
    const hasPhoto = charsWithPhoto.some((withPhoto: SceneCharacter) => withPhoto.id === char.id);
    const photoNote = hasPhoto ? " [REPRODUCE EXACT FACE FROM REFERENCE PHOTO]" : "";
    if (dna?.lockedPrompt) return `${char.name}${photoNote}: ${dna.lockedPrompt}`;
    return `${char.name}${photoNote}: ${char.physicalDescription}. Outfit: ${char.outfit}.`;
  }).join("\n");

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
- Avoid any visible text, captions, signs, subtitles, labels, letters or typography in the image

STYLE: ${series.visualStyle}, high quality animation render, vibrant colors, professional composition`;

  const mode: "edit" | "generate" = inputImageUrls.length > 0 ? "edit" : "generate";

  if (presentChars.length > 0 && mode !== "edit") {
    throw new Error("Impossible de lancer la génération sans références image valides pour les personnages de cette scène.");
  }

  const body: Record<string, unknown> = {
    prompt: prompt.slice(0, 1500),
    mode,
    aspectRatio,
    imageQuality: model === "nano-banana-pro" ? "2K" : "HD",
  };

  if (mode === "edit" && inputImageUrls.length > 0) {
    body.inputImageUrls = inputImageUrls;
  }

  const genRes = await fetch(`${NANOBANA_BASE}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${nanoBanaKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!genRes.ok) {
    const err = await genRes.text();
    throw new Error(`Nano Banana ${genRes.status}: ${err.slice(0, 400)}`);
  }

  const genData = await genRes.json();
  const generationId = genData.generationId || genData.data?.generationId;
  if (!generationId) {
    throw new Error(`Pas de generationId: ${JSON.stringify(genData).slice(0, 200)}`);
  }

  const imageUrl = await pollStatus(nanoBanaKey, generationId);
  if (!imageUrl) throw new Error("Pas d'image dans le résultat");

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

  return {
    imageUrl,
    sceneId,
    generator: model === "nano-banana" ? "Nano Banana" : "Nano Banana Pro",
    mode,
    referencesUploaded: uploadedChars,
    totalRefs: inputImageUrls.length,
    environmentName: matchedEnv?.name,
    charsWithoutPhoto: presentChars
      .filter((c: SceneCharacter) => !charsWithPhoto.some((cp: SceneCharacter) => cp.id === c.id))
      .map((c: SceneCharacter) => c.name),
    charsMissingValidRef: missingCharacterRefs,
    autoRouted,
  };
}

export async function validateNanoBananaAutoRoute(params: {
  scene: {
    action?: string | null;
    camera?: string | null;
    emotion?: string | null;
    location?: string | null;
    charactersJson?: string | null;
  };
  series: {
    characters: SceneCharacter[];
    environments: SceneEnvironment[];
  };
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sceneCharNames: string[] = JSON.parse(params.scene.charactersJson || "[]");
  const presentChars = params.series.characters.filter((character) =>
    sceneCharNames.some((name: string) => name.toLowerCase().includes(character.name.toLowerCase()))
  );

  if (presentChars.length <= 1) return { ok: true };

  const validRefs: string[] = [];
  for (const char of presentChars) {
    if (!char.referenceImageUrl) continue;
    const url = await getPublicUrl(char.referenceImageUrl);
    if (url) validRefs.push(char.name);
  }

  const missing = presentChars
    .filter((char) => !validRefs.includes(char.name))
    .map((char) => char.name);

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Nano Banana nécessite une photo valide pour chaque personnage. Manquantes: ${missing.join(", ")}`,
    };
  }

  return { ok: true };
}
