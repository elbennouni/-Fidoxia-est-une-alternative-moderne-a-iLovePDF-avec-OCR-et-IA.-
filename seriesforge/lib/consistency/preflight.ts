import type {
  PreflightReport,
  StrictCharacterRecord,
  StrictSceneDefinition,
} from "./types";

function hasCharacterReference(character: StrictCharacterRecord): boolean {
  return character.faceReferenceImages.length > 0 || character.fullBodyReferenceImages.length > 0;
}

export function runScenePreflightCheck(params: {
  scene: StrictSceneDefinition;
  characters: StrictCharacterRecord[];
}): PreflightReport {
  const { scene, characters } = params;
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (!scene.negativePrompt?.trim()) {
    blockers.push("Prompt négatif obligatoire manquant.");
  }

  if (!scene.camera?.shotType || !scene.camera?.angle || !scene.camera?.movement) {
    blockers.push("Caméra incomplète : shotType, angle et movement sont obligatoires.");
  }

  if (!scene.environment?.name || !scene.environment?.description) {
    blockers.push("Décor incomplet : nom et description sont obligatoires.");
  }

  for (const sceneCharacter of scene.characters) {
    const character = characters.find((item) => item.id === sceneCharacter.characterId);
    if (!character) {
      blockers.push(`Personnage introuvable pour la scène : ${sceneCharacter.name}.`);
      continue;
    }

    if (!character.visualDNA?.summary?.trim()) {
      blockers.push(`visualDNA manquant pour ${character.name}.`);
    }

    if (sceneCharacter.presence === "main" && !hasCharacterReference(character)) {
      blockers.push(`Référence personnage manquante : risque de perte de ressemblance. (${character.name})`);
    }

    if (!sceneCharacter.outfitMode) {
      blockers.push(`Tenue non définie pour ${character.name}.`);
    }

    if (sceneCharacter.outfitMode === "use_reference" && !sceneCharacter.outfitReferenceId) {
      blockers.push(`Tenue de référence manquante pour ${character.name}.`);
    }
  }

  if (scene.dialogue?.trim()) {
    if (!scene.activeSpeakerCharacterId) {
      blockers.push("activeSpeakerCharacterId obligatoire pour une scène avec dialogue.");
    }

    const activeSpeaker = scene.characters.find((item) => item.characterId === scene.activeSpeakerCharacterId);
    if (!activeSpeaker) {
      blockers.push("Le personnage active speaker n'est pas présent dans la scène.");
    }

    if (!scene.audioFile?.trim()) {
      const speakerCharacter = characters.find((item) => item.id === scene.activeSpeakerCharacterId);
      if (!speakerCharacter?.voiceReferenceAudio?.trim()) {
        blockers.push("Lipsync activé mais aucun audio ou voix de référence n'est disponible.");
      }
    }
  }

  for (const character of characters) {
    if (character.role === "main" && !hasCharacterReference(character)) {
      warnings.push(`Référence personnage manquante : risque de perte de ressemblance. (${character.name})`);
    }
  }

  if (scene.characters.length === 0) {
    warnings.push("Aucun personnage assigné à cette scène.");
  }

  return {
    ok: blockers.length === 0,
    requiresAdminOverride: blockers.length > 0,
    issues: [
      ...blockers.map((message) => ({ level: "error" as const, code: "preflight-error", message })),
      ...warnings.map((message) => ({ level: "warning" as const, code: "preflight-warning", message })),
    ],
  };
}

export const computePreflight = runScenePreflightCheck;
