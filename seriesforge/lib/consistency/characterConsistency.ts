import {
  DEFAULT_FACE_CONSISTENCY_STRENGTH,
  DEFAULT_GLOBAL_NEGATIVE_PROMPT,
  DEFAULT_OUTFIT_CONSISTENCY_STRENGTH,
} from "./constants";
import type {
  CharacterConsistencySnapshot,
  CharacterPhysicalTraits,
  SceneCharacterUsage,
} from "./types";

function normalizeList(value?: string[] | null): string[] {
  return (value || []).map((item) => item.trim()).filter(Boolean);
}

function buildPhysicalTraitsSummary(traits: CharacterPhysicalTraits): string {
  const distinctive = traits.distinctiveFeatures.length > 0
    ? ` Distinctive features: ${traits.distinctiveFeatures.join(", ")}.`
    : "";

  return [
    `Gender: ${traits.gender || "unspecified"}.`,
    `Age range: ${traits.ageRange || "unspecified"}.`,
    `Hair: ${traits.hair || "unspecified"}.`,
    `Eyes: ${traits.eyes || "unspecified"}.`,
    `Face shape: ${traits.faceShape || "unspecified"}.`,
    `Skin tone: ${traits.skinTone || "unspecified"}.`,
    `Body type: ${traits.bodyType || "unspecified"}.`,
  ].join(" ") + distinctive;
}

export function buildNegativeIdentityPrompt(): string {
  return [
    "wrong face",
    "different person",
    "changed identity",
    "generic face",
    "face swap artifact",
    "distorted face",
    "changed jawline",
    "changed nose",
    "changed eyes",
    "changed lips",
    "changed hairstyle",
    "wrong age",
    "plastic skin",
    "uncanny face",
    "asymmetrical face",
    "bad anatomy",
    "mutated hands",
    "extra fingers",
    "deformed body",
  ].join(", ");
}

export function buildVisualDNA(character: {
  name: string;
  physicalTraits: CharacterPhysicalTraits;
  description: string;
}): string {
  const summary = buildPhysicalTraitsSummary(character.physicalTraits);
  return `Keep exact facial identity of ${character.name} from reference images: same face structure, same jawline, same nose, same eyes, same eyebrows, same mouth, same hairstyle, same skin tone, same age impression, same facial proportions. Do not stylize into a generic face. ${summary} Description anchor: ${character.description}`.trim();
}

export function buildConsistencyPrompt(character: {
  name: string;
  description: string;
  outfit: string;
  physicalTraits: CharacterPhysicalTraits;
  visualDNA?: string;
}): string {
  const dna = character.visualDNA || buildVisualDNA({
    name: character.name,
    physicalTraits: character.physicalTraits,
    description: character.description,
  });
  return `Always keep this exact character identity: ${character.name}. ${dna} Outfit anchor: ${character.outfit || "default outfit"}. Never change face, outfit, age, body type or visual identity.`;
}

export function buildCharacterConsistencySnapshot(character: {
  id: string;
  name: string;
  role?: string | null;
  physicalDescription?: string | null;
  outfit?: string | null;
  voiceProfile?: string | null;
  heygenVoiceId?: string | null;
  consistencyPrompt?: string | null;
  visualDNA?: string | null;
  negativeIdentityPrompt?: string | null;
  faceReferenceImages?: string | null;
  fullBodyReferenceImages?: string | null;
  outfitReferenceImages?: string | null;
  voiceReferenceAudio?: string | null;
  identityLock?: boolean | null;
  faceConsistencyStrength?: number | null;
  outfitConsistencyStrength?: number | null;
  physicalTraits?: string | null;
}): CharacterConsistencySnapshot {
  let parsedTraits: CharacterPhysicalTraits | null = null;
  try {
    parsedTraits = character.physicalTraits ? JSON.parse(character.physicalTraits) as CharacterPhysicalTraits : null;
  } catch {
    parsedTraits = null;
  }

  const physicalTraits: CharacterPhysicalTraits = parsedTraits || {
    gender: "",
    ageRange: "",
    hair: "",
    eyes: "",
    faceShape: "",
    skinTone: "",
    bodyType: "",
    distinctiveFeatures: [],
  };

  const faceReferenceImages = normalizeList(character.faceReferenceImages ? JSON.parse(character.faceReferenceImages) as string[] : []);
  const fullBodyReferenceImages = normalizeList(character.fullBodyReferenceImages ? JSON.parse(character.fullBodyReferenceImages) as string[] : []);
  const outfitReferenceImages = normalizeList(character.outfitReferenceImages ? JSON.parse(character.outfitReferenceImages) as string[] : []);

  const visualDNAText = character.visualDNA || buildVisualDNA({
    name: character.name,
    physicalTraits,
    description: character.physicalDescription || "",
  });
  const visualDNA = {
    summary: visualDNAText,
    identityLockPrompt: visualDNAText,
    resemblancePrompt: visualDNAText,
  };

  return {
    id: character.id,
    name: character.name,
    role: character.role === "secondary" || character.role === "extra" ? character.role : "main",
    description: character.physicalDescription || "",
    voiceProfile: character.voiceProfile || null,
    heygenVoiceId: character.heygenVoiceId || null,
    voiceReferenceAudio: character.voiceReferenceAudio || null,
    faceReferenceImages,
    fullBodyReferenceImages,
    outfitReferenceImages,
    identityLock: character.identityLock ?? true,
    faceConsistencyStrength: character.faceConsistencyStrength ?? DEFAULT_FACE_CONSISTENCY_STRENGTH,
    outfitConsistencyStrength: character.outfitConsistencyStrength ?? DEFAULT_OUTFIT_CONSISTENCY_STRENGTH,
    physicalTraits,
    visualDNA,
    negativeIdentityPrompt: character.negativeIdentityPrompt || buildNegativeIdentityPrompt(),
    defaultOutfit: character.outfit || "",
    consistencyPrompt: character.consistencyPrompt || buildConsistencyPrompt({
      name: character.name,
      description: character.physicalDescription || "",
      outfit: character.outfit || "",
      physicalTraits,
      visualDNA: visualDNA.summary,
    }),
  };
}

export function ensureCharacterConsistency(character: {
  id: string;
  name: string;
  role?: string | null;
  physicalDescription?: string | null;
  description?: string | null;
  outfit?: string | null;
  personality?: string | null;
  voiceProfile?: string | null;
  heygenVoiceId?: string | null;
  consistencyPrompt?: string | null;
  visualDNA?: string | null;
  negativeIdentityPrompt?: string | null;
  faceReferenceImages?: string[] | string | null;
  fullBodyReferenceImages?: string[] | string | null;
  outfitReferenceImages?: string[] | string | null;
  voiceReferenceAudio?: string | null;
  identityLock?: boolean | null;
  faceConsistencyStrength?: number | null;
  outfitConsistencyStrength?: number | null;
  physicalTraits?: CharacterPhysicalTraits | string | null;
  referenceImageUrl?: string | null;
}): CharacterConsistencySnapshot {
  return buildCharacterConsistencySnapshot({
    id: character.id,
    name: character.name,
    role: character.role,
    physicalDescription: character.physicalDescription || character.description || "",
    outfit: character.outfit || "",
    voiceProfile: character.voiceProfile,
    heygenVoiceId: character.heygenVoiceId,
    consistencyPrompt: character.consistencyPrompt,
    visualDNA: typeof character.visualDNA === "string" ? character.visualDNA : null,
    negativeIdentityPrompt: character.negativeIdentityPrompt,
    faceReferenceImages: typeof character.faceReferenceImages === "string"
      ? character.faceReferenceImages
      : JSON.stringify(character.faceReferenceImages || (character.referenceImageUrl ? [character.referenceImageUrl] : [])),
    fullBodyReferenceImages: typeof character.fullBodyReferenceImages === "string"
      ? character.fullBodyReferenceImages
      : JSON.stringify(character.fullBodyReferenceImages || []),
    outfitReferenceImages: typeof character.outfitReferenceImages === "string"
      ? character.outfitReferenceImages
      : JSON.stringify(character.outfitReferenceImages || []),
    voiceReferenceAudio: character.voiceReferenceAudio,
    identityLock: character.identityLock,
    faceConsistencyStrength: character.faceConsistencyStrength,
    outfitConsistencyStrength: character.outfitConsistencyStrength,
    physicalTraits: typeof character.physicalTraits === "string"
      ? character.physicalTraits
      : JSON.stringify(character.physicalTraits || {
          gender: "",
          ageRange: "",
          hair: "",
          eyes: "",
          faceShape: "",
          skinTone: "",
          bodyType: "",
          distinctiveFeatures: [],
        }),
  });
}

export function characterHasRequiredReference(character: CharacterConsistencySnapshot): boolean {
  return character.faceReferenceImages.length > 0 || character.fullBodyReferenceImages.length > 0;
}

export function getCharacterReferenceWarning(character: CharacterConsistencySnapshot): string | null {
  if (character.role !== "main") return null;
  return characterHasRequiredReference(character)
    ? null
    : "Référence personnage manquante : risque de perte de ressemblance.";
}

export function buildIdentityLockLine(params: {
  character: CharacterConsistencySnapshot;
  usage?: SceneCharacterUsage;
}): string {
  const { character, usage } = params;
  const outfitText = usage?.outfitMode === "custom"
    ? usage.customOutfitDescription || character.defaultOutfit || "custom outfit"
    : usage?.outfitMode === "use_reference" && character.outfitReferenceImages[0]
      ? `use outfit reference ${character.outfitReferenceImages[0]}`
      : character.defaultOutfit || "default outfit";

  return `${character.name} identity lock: keep the same face, same facial proportions, same hairstyle, same skin tone, same expression logic, same body type as reference. Outfit: ${outfitText}. ${character.visualDNA.summary}`;
}

export function buildCharacterNegativePrompt(character: CharacterConsistencySnapshot): string {
  return [character.negativeIdentityPrompt, DEFAULT_GLOBAL_NEGATIVE_PROMPT]
    .filter(Boolean)
    .join(", ");
}

export type CharacterConsistencyProfile = CharacterConsistencySnapshot;

export function buildCharacterConsistencyProfile(character: Parameters<typeof buildCharacterConsistencySnapshot>[0]): CharacterConsistencySnapshot {
  return buildCharacterConsistencySnapshot(character);
}

export function normalizeCharacterRole(role?: string | null): "main" | "secondary" | "extra" {
  return role === "secondary" || role === "extra" ? role : "main";
}

export function parseJsonList(value?: string | string[] | null, fallback: string[] = []): string[] {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as string[];
    return Array.isArray(parsed) ? parsed.map((item) => item.trim()).filter(Boolean) : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeCharacterStrictRefs(value?: string | string[] | null, legacy?: string | null): string[] {
  const parsed = parseJsonList(value, []);
  if (parsed.length > 0) return parsed;
  return legacy ? [legacy] : [];
}

export function parseSceneCharacters(value?: string | null, fallbackNames: string[] = []): SceneCharacterUsage[] {
  if (!value) {
    return fallbackNames.map((name, index) => ({
      characterId: `fallback-${index}`,
      name,
      presence: index === 0 ? "main" : "background",
      activeSpeaker: index === 0,
      lipSyncRequired: false,
      expression: "neutral",
      action: "hold position",
      positionInFrame: index === 0 ? "center frame" : "background right",
      outfitMode: "use_default",
    }));
  }
  try {
    const parsed = JSON.parse(value) as SceneCharacterUsage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function analyzeCharacterConsistency(character: CharacterConsistencySnapshot): { ok: boolean; warning?: string } {
  const warning = getCharacterReferenceWarning(character) || undefined;
  return { ok: !warning, warning };
}

export function buildCharacterWarning(character: CharacterConsistencySnapshot): string {
  return getCharacterReferenceWarning(character) || "";
}

export function hasCharacterReference(character: CharacterConsistencySnapshot): boolean {
  return characterHasRequiredReference(character);
}
