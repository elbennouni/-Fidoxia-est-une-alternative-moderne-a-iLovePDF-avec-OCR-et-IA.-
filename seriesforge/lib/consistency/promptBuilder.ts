import { GLOBAL_NEGATIVE_PROMPT } from "./constants";
import type {
  GenerationPayload,
  GenerationReferenceImage,
  StrictCharacterRecord,
  StrictSceneDefinition,
  SceneEnvironmentConfig,
  SceneCharacterUsage,
} from "./types";

function resolveEnvironmentBlock(environment: SceneEnvironmentConfig): string {
  return [
    environment.description,
    environment.lighting ? `Lighting: ${environment.lighting}` : "",
    environment.mood ? `Mood: ${environment.mood}` : "",
  ].filter(Boolean).join(". ");
}

function resolveCharacterVisualDNA(character: StrictCharacterRecord): string {
  return character.visualDNA.lockedPrompt || character.visualDNA.identityLockPrompt || `Keep exact facial identity of ${character.name} from reference images: same face structure, same jawline, same nose, same eyes, same eyebrows, same mouth, same hairstyle, same skin tone, same age impression, same facial proportions. Do not stylize into a generic face.`;
}

function resolveOutfitLine(sceneCharacter: SceneCharacterUsage, character: StrictCharacterRecord): string {
  if (sceneCharacter.outfitMode === "custom") {
    return sceneCharacter.outfitReferenceId ? `custom outfit: ${sceneCharacter.outfitReferenceId}` : "custom outfit";
  }
  if (sceneCharacter.outfitMode === "use_reference") {
    return sceneCharacter.outfitReferenceId ? `use outfit reference ${sceneCharacter.outfitReferenceId}` : "use outfit reference";
  }
  return character.defaultOutfit || "use default outfit";
}

function buildCharacterLine(sceneCharacter: SceneCharacterUsage, character: StrictCharacterRecord): string {
  return `- ${character.name}: identity locked from reference images. ${resolveCharacterVisualDNA(character)} Action: ${sceneCharacter.action}. Expression: ${sceneCharacter.expression}. Position: ${sceneCharacter.positionInFrame}. Outfit: ${resolveOutfitLine(sceneCharacter, character)}.`;
}

function buildReferenceImages(
  scene: StrictSceneDefinition,
  characters: StrictCharacterRecord[],
): GenerationReferenceImage[] {
  const references: GenerationReferenceImage[] = [];

  for (const sceneCharacter of scene.characters) {
    const character = characters.find((item) => item.id === sceneCharacter.characterId);
    if (!character) continue;

    if (character.faceReferenceImages[0]) {
      references.push({
        type: "face",
        characterId: character.id,
        url: character.faceReferenceImages[0],
        strength: character.faceConsistencyStrength,
      });
    } else if (character.fullBodyReferenceImages[0]) {
      references.push({
        type: "full_body",
        characterId: character.id,
        url: character.fullBodyReferenceImages[0],
        strength: character.faceConsistencyStrength,
      });
    }

    if (sceneCharacter.outfitMode === "use_reference") {
      const outfitUrl = character.outfitReferenceImages[0];
      if (outfitUrl) {
        references.push({
          type: "outfit",
          characterId: character.id,
          url: outfitUrl,
          strength: character.outfitConsistencyStrength,
        });
      }
    }
  }

  for (const url of scene.environment.referenceImages) {
    references.push({
      type: "environment",
      url,
      strength: 0.65,
    });
  }

  return references;
}

function prioritizeReferenceImages(images: GenerationReferenceImage[]): GenerationReferenceImage[] {
  const order: Record<GenerationReferenceImage["type"], number> = {
    face: 0,
    full_body: 1,
    outfit: 2,
    pose: 3,
    environment: 4,
  };

  return [...images].sort((left, right) => order[left.type] - order[right.type]);
}

export function buildScenePrompts(params: {
  scene: StrictSceneDefinition;
  characters: StrictCharacterRecord[];
}): {
  promptImage: string;
  promptVideo: string;
  negativePrompt: string;
  referenceImages: GenerationReferenceImage[];
  audio: GenerationPayload["audio"];
} {
  const { scene, characters } = params;
  const sceneCharacters = scene.characters
    .map((item) => {
      const character = characters.find((entry) => entry.id === item.characterId);
      if (!character) return null;
      return buildCharacterLine(item, character);
    })
    .filter((item): item is string => Boolean(item));

  const activeSpeaker = scene.characters.find((item) => item.activeSpeaker);
  const activeSpeakerProfile = characters.find((item) => item.id === activeSpeaker?.characterId);

  const promptImage = [
    "Use the provided reference images as strict identity references. Preserve the exact identity and facial likeness of every main character.",
    "",
    `SCENE:\n${scene.title}. ${scene.narration || scene.dialogue || "Detailed cinematic shot."}`,
    "",
    `CHARACTERS:\n${sceneCharacters.join("\n") || "- No explicit characters."}`,
    "",
    `ENVIRONMENT:\n${resolveEnvironmentBlock(scene.environment)}`,
    "",
    `CAMERA:\n${scene.camera.shotType}, ${scene.camera.angle}, ${scene.camera.lens}, ${scene.camera.movement}, ${scene.camera.depthOfField}`,
    "",
    "STYLE:\nPhotorealistic, cinematic, ultra detailed skin texture, natural anatomy, high dynamic range, film grain, editorial quality.",
    "",
    `CONSISTENCY:\n${scene.consistencyRules.join(" ") || "Do not change the faces. Do not replace the characters. Do not invent new outfits if outfit references exist. Keep exact facial identity and body proportions."}`,
    "",
    `NEGATIVE PROMPT:\n${scene.negativePrompt || GLOBAL_NEGATIVE_PROMPT}`,
  ].join("\n");

  const characterMotion = scene.characters
    .map((item) => {
      const character = characters.find((entry) => entry.id === item.characterId);
      return `- ${character?.name || item.name}: ${item.action}`;
    })
    .join("\n");

  const promptVideo = [
    "Use the generated image as the first frame and preserve all character identities.",
    "",
    `VIDEO DIRECTION:\n${scene.videoPrompt || scene.narration || scene.title}`,
    "",
    `CHARACTER MOTION:\n${characterMotion || "- No motion specified."}`,
    "",
    `ACTIVE SPEAKER:\nOnly ${activeSpeakerProfile?.name || "the active speaker"} speaks in this shot.\nLip sync only on ${activeSpeakerProfile?.name || "the active speaker"}.\nOther characters must not move their lips. They can react with eyes, head movement, breathing, subtle facial expression.`,
    "",
    `DIALOGUE:\n${scene.dialogue || "No dialogue."}`,
    "",
    `CAMERA:\n${scene.camera.movement}`,
    "",
    "DO NOT:\nDo not morph faces.\nDo not change outfit.\nDo not add new characters.\nDo not animate lips of non-speaking characters.\nDo not create random gestures.\nDo not make the scene static.",
  ].join("\n");

  const referenceImages = prioritizeReferenceImages(buildReferenceImages(scene, characters));

  return {
    promptImage,
    promptVideo,
    negativePrompt: scene.negativePrompt || GLOBAL_NEGATIVE_PROMPT,
    referenceImages,
    audio: {
      activeSpeakerCharacterId: scene.activeSpeakerCharacterId || undefined,
      fileUrl: scene.audioFile || activeSpeakerProfile?.voiceReferenceAudio || undefined,
      lipsync: Boolean(scene.characters.some((item) => item.lipSyncRequired)),
    },
  };
}

export function buildGenerationPayload(params: {
  scene: StrictSceneDefinition;
  characters: StrictCharacterRecord[];
}): GenerationPayload {
  const prompts = buildScenePrompts(params);

  return {
    promptImage: prompts.promptImage,
    promptVideo: prompts.promptVideo,
    negativePrompt: prompts.negativePrompt,
    referenceImages: prompts.referenceImages,
    audio: prompts.audio,
  };
}

export const buildPromptSet = buildScenePrompts;
