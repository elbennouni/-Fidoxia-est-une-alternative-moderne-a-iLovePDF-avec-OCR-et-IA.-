import type { StrictCharacterProfile, SceneConsistencyData, SceneEnvironmentData, GenerationReferenceImage, SceneCharacterUsage } from "./types";
import { buildCharacterWarning, hasCharacterReference } from "./characterConsistency";

export type RawCharacter = {
  id: string;
  name: string;
  role?: string | null;
  physicalDescription: string;
  outfit: string;
  personality: string;
  voiceProfile?: string | null;
  heygenVoiceId?: string | null;
  referenceImageUrl?: string | null;
  faceReferenceImages?: unknown;
  fullBodyReferenceImages?: unknown;
  outfitReferenceImages?: unknown;
  voiceReferenceAudio?: string | null;
  identityLock?: boolean | null;
  faceConsistencyStrength?: number | null;
  outfitConsistencyStrength?: number | null;
  physicalTraits?: unknown;
  visualDNA?: unknown;
  negativeIdentityPrompt?: string | null;
  consistencyPrompt?: string | null;
};

export type RawEnvironment = {
  id: string;
  name: string;
  description: string;
  lighting?: string | null;
  mood?: string | null;
  previewImageUrl?: string | null;
};

export type RawScene = {
  id: string;
  sceneNumber?: number | null;
  title?: string | null;
  duration?: number | null;
  format?: string | null;
  location?: string | null;
  action?: string | null;
  emotion?: string | null;
  imagePrompt?: string | null;
  videoPrompt?: string | null;
  dialogue?: string | null;
  narration?: string | null;
  voiceUrl?: string | null;
  audioPrompt?: string | null;
  camera?: string | null;
  negativePrompt?: string | null;
  charactersJson?: string | null;
  characterDetailsJson?: string | null;
  environmentRefJson?: string | null;
  cameraJson?: string | null;
  consistencyRulesJson?: string | null;
  activeSpeakerCharacterId?: string | null;
  lipSyncEnabled?: boolean | null;
  preflightWarningsJson?: string | null;
};

function parseJson<T>(value: unknown, fallback?: T): T {
  if (value === undefined || value === null) return fallback as T;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback as T;
  }
}

export function buildCharacterProfile(raw: RawCharacter): StrictCharacterProfile {
  const physicalTraits = parseJson<StrictCharacterProfile["physicalTraits"]>(raw.physicalTraits, {
    gender: "",
    ageRange: "",
    hair: "",
    eyes: "",
    faceShape: "",
    skinTone: "",
    bodyType: "",
    distinctiveFeatures: [],
  });

  const faceReferenceImages = Array.isArray(raw.faceReferenceImages)
    ? raw.faceReferenceImages
    : parseJson<string[]>(raw.faceReferenceImages, raw.referenceImageUrl ? [raw.referenceImageUrl] : []);
  const fullBodyReferenceImages = Array.isArray(raw.fullBodyReferenceImages)
    ? raw.fullBodyReferenceImages
    : parseJson<string[]>(raw.fullBodyReferenceImages, []);
  const outfitReferenceImages = Array.isArray(raw.outfitReferenceImages)
    ? raw.outfitReferenceImages
    : parseJson<string[]>(raw.outfitReferenceImages, []);
  const voiceReferenceAudio = raw.voiceReferenceAudio ? [raw.voiceReferenceAudio] : [];

  return {
    id: raw.id,
    name: raw.name,
    role: raw.role === "secondary" || raw.role === "extra" ? raw.role : "main",
    description: raw.physicalDescription,
    faceReferenceImages,
    fullBodyReferenceImages,
    outfitReferenceImages,
    voiceReferenceAudio: voiceReferenceAudio[0],
    identityLock: raw.identityLock !== false,
    faceConsistencyStrength: raw.faceConsistencyStrength ?? 0.85,
    outfitConsistencyStrength: raw.outfitConsistencyStrength ?? 0.75,
    physicalTraits,
    visualDNA: typeof raw.visualDNA === "string" && raw.visualDNA
      ? parseJson(raw.visualDNA, {
          summary: raw.visualDNA,
          identityLockPrompt: raw.visualDNA,
          resemblancePrompt: raw.visualDNA,
        })
      : {
      summary: "",
      identityLockPrompt: "",
      resemblancePrompt: "",
      },
    negativeIdentityPrompt: raw.negativeIdentityPrompt || "",
    consistencyPrompt: raw.consistencyPrompt || "",
    legacyReferenceImageUrl: raw.referenceImageUrl || undefined,
    legacyConsistencyPrompt: raw.consistencyPrompt || undefined,
    legacyOutfit: raw.outfit || undefined,
    legacyVoiceProfile: raw.voiceProfile || undefined,
    legacyHeygenVoiceId: raw.heygenVoiceId || undefined,
  };
}

export function buildEnvironmentProfile(raw?: RawEnvironment | null): SceneEnvironmentData {
  return {
    name: raw?.name || "Décor à définir",
    description: raw?.description || "",
    referenceImages: raw?.previewImageUrl ? [raw.previewImageUrl] : [],
    lighting: raw?.lighting || "",
    mood: raw?.mood || "",
  };
}

export function buildSceneCharacters(params: {
  scene: RawScene;
  characters: StrictCharacterProfile[];
}): SceneCharacterUsage[] {
  const { scene, characters } = params;
  const explicitCharacters = parseJson<SceneCharacterUsage[]>(scene.characterDetailsJson, []);
  if (explicitCharacters.length > 0) return explicitCharacters;

  const characterNames = parseJson<string[]>(scene.charactersJson, []);
  const resolved = characterNames.map((name, index) => {
    const matched = characters.find((character) => name.toLowerCase().includes(character.name.toLowerCase()));
    return {
      characterId: matched?.id || `unknown-${index}`,
      name: matched?.name || name,
      presence: (index === 0 ? "main" : "background") as "main" | "background",
      activeSpeaker: Boolean(scene.activeSpeakerCharacterId && matched?.id === scene.activeSpeakerCharacterId),
      lipSyncRequired: Boolean(scene.lipSyncEnabled && scene.activeSpeakerCharacterId && matched?.id === scene.activeSpeakerCharacterId),
      expression: scene.emotion || "neutral",
      action: scene.action || "hold position",
      positionInFrame: index === 0 ? "center frame" : "background right",
      outfitMode: "use_default" as const,
      outfitReferenceId: undefined,
    };
  });

  if (!scene.activeSpeakerCharacterId && scene.dialogue?.trim() && resolved.length > 0) {
    resolved[0].activeSpeaker = true;
    resolved[0].lipSyncRequired = true;
  }

  return resolved;
}

export function hydrateConsistencyScene(params: {
  scene: RawScene;
  episodeFormat?: string | null;
  characters: StrictCharacterProfile[];
  matchedEnvironment?: RawEnvironment | null;
}): SceneConsistencyData {
  const { scene, episodeFormat, characters, matchedEnvironment } = params;
  const sceneCharacters = buildSceneCharacters({ scene, characters });
  const environmentFromJson = parseJson<SceneEnvironmentData | null>(scene.environmentRefJson, null);
  const environment = environmentFromJson || buildEnvironmentProfile(matchedEnvironment);
  const camera = parseJson<SceneConsistencyData["camera"]>(scene.cameraJson, {
    shotType: scene.camera || "medium shot",
    angle: "eye level",
    lens: "50mm",
    movement: "static with subtle cinematic energy",
    depthOfField: "shallow depth of field",
  });
  const consistencyRules = parseJson<string[]>(scene.consistencyRulesJson, []);
  const preflightWarnings = parseJson<string[]>(scene.preflightWarningsJson, []);

  return {
    id: scene.id,
    title: scene.title || scene.location || `Scène ${scene.sceneNumber || 1}`,
    duration: scene.duration || 5,
    format: scene.format === "16:9" || scene.format === "1:1" ? scene.format : (episodeFormat === "16:9" || episodeFormat === "1:1" ? episodeFormat : "9:16"),
    characters: sceneCharacters,
    environment,
    camera,
    imagePrompt: scene.imagePrompt || "",
    videoPrompt: scene.videoPrompt || "",
    dialogue: scene.dialogue || "",
    narration: scene.narration || "",
    audioFile: scene.voiceUrl || undefined,
    activeSpeakerCharacterId: scene.activeSpeakerCharacterId || undefined,
    negativePrompt: scene.negativePrompt || "",
    consistencyRules,
    preflightWarnings,
  };
}

export function hydrateStrictSceneContext(params: {
  scene: RawScene;
  episodeFormat?: string | null;
  series: { characters: RawCharacter[]; environments: RawEnvironment[] };
  fallbackEnvironment?: RawEnvironment | null;
}): SceneConsistencyData {
  const characters = params.series.characters.map((character) => buildCharacterProfile(character));
  const sceneCharacters = parseJson<string[]>(params.scene.charactersJson, []);
  const matchedEnvironment =
    params.series.environments.find((environment) =>
      params.scene.location?.toLowerCase().includes(environment.name.toLowerCase())
    ) || params.fallbackEnvironment || params.series.environments[0] || null;

  const hydrated = hydrateConsistencyScene({
    scene: params.scene,
    episodeFormat: params.episodeFormat,
    characters,
    matchedEnvironment,
  });

  if (hydrated.characters.length === 0 && sceneCharacters.length > 0) {
    hydrated.characters = buildSceneCharacters({ scene: params.scene, characters });
  }

  return hydrated;
}

export function buildSceneConsistencyContext(params: {
  scene: RawScene;
  seriesCharacters: RawCharacter[];
  seriesEnvironments: RawEnvironment[];
  episodeFormat?: string | null;
}) {
  const characters = params.seriesCharacters.map((character) => buildCharacterProfile(character));
  const environment =
    params.seriesEnvironments.find((item) =>
      params.scene.location?.toLowerCase().includes(item.name.toLowerCase())
    ) || params.seriesEnvironments[0] || null;

  return hydrateConsistencyScene({
    scene: params.scene,
    episodeFormat: params.episodeFormat,
    characters,
    matchedEnvironment: environment,
  });
}

export function buildGenerationReferenceImages(params: {
  scene: SceneConsistencyData;
  characters: StrictCharacterProfile[];
}): GenerationReferenceImage[] {
  const references: GenerationReferenceImage[] = [];
  const addRef = (reference: GenerationReferenceImage) => {
    if (!references.some((item) => item.type === reference.type && item.characterId === reference.characterId && item.url === reference.url)) {
      references.push(reference);
    }
  };

  for (const sceneCharacter of params.scene.characters) {
    const profile = params.characters.find((character) => character.id === sceneCharacter.characterId);
    if (!profile) continue;

    const faceRef = profile.faceReferenceImages[0] || profile.legacyReferenceImageUrl;
    if (faceRef) {
      addRef({
        type: "face",
        characterId: profile.id,
        url: faceRef,
        strength: profile.faceConsistencyStrength,
      });
    }

    const fullBodyRef = profile.fullBodyReferenceImages[0];
    if (fullBodyRef) {
      addRef({
        type: "full_body",
        characterId: profile.id,
        url: fullBodyRef,
        strength: profile.faceConsistencyStrength,
      });
    }

    if (sceneCharacter.outfitMode === "use_reference") {
      const outfitRef = profile.outfitReferenceImages[0];
      if (outfitRef) {
        addRef({
          type: "outfit",
          characterId: profile.id,
          url: outfitRef,
          strength: profile.outfitConsistencyStrength,
        });
      }
    }
  }

  for (const environmentImage of params.scene.environment.referenceImages) {
    addRef({
      type: "environment",
      url: environmentImage,
      strength: 0.6,
    });
  }

  return references;
}

export function buildCharacterWarnings(characters: StrictCharacterProfile[]): string[] {
  const warnings: string[] = [];
  for (const character of characters) {
    if (character.role === "main" && !hasCharacterReference(character)) {
      warnings.push(buildCharacterWarning(character));
    }
  }
  return warnings;
}

export { hydrateConsistencyScene as hydrateSceneConsistency };
