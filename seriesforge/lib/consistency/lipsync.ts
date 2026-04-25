import type { SceneCharacterUsage, StrictSceneDefinition } from "./types";

function splitDialogueTurns(dialogue: string): Array<{ speaker: string; line: string }> {
  return dialogue
    .split("\n")
    .map((rawLine) => rawLine.trim())
    .filter(Boolean)
    .map((rawLine) => {
      const match = rawLine.match(/^([^:\n]{1,60})\s*:\s*(.+)$/);
      if (!match) return null;
      return {
        speaker: match[1].trim(),
        line: match[2].trim(),
      };
    })
    .filter((turn): turn is { speaker: string; line: string } => Boolean(turn));
}

function cloneCharacters(characters: SceneCharacterUsage[]): SceneCharacterUsage[] {
  return characters.map((character) => ({ ...character }));
}

export interface PlannedShot {
  title: string;
  dialogue: string;
  narration: string;
  activeSpeakerCharacterId?: string;
  lipSyncRequired: boolean;
  characters: SceneCharacterUsage[];
}

export function planLipSyncShots(scene: StrictSceneDefinition): PlannedShot[] {
  const dialogue = scene.dialogue.trim();
  if (!dialogue) {
    return [
      {
        title: scene.title,
        dialogue: "",
        narration: scene.narration,
        activeSpeakerCharacterId: undefined,
        lipSyncRequired: false,
        characters: cloneCharacters(scene.characters).map((character) => ({
          ...character,
          activeSpeaker: false,
          lipSyncRequired: false,
        })),
      },
    ];
  }

  const turns = splitDialogueTurns(dialogue);
  if (turns.length <= 1) {
    const activeSpeaker = scene.activeSpeakerCharacterId || scene.characters.find((character) => character.activeSpeaker)?.characterId;
    return [
      {
        title: scene.title,
        dialogue,
        narration: scene.narration,
        activeSpeakerCharacterId: activeSpeaker,
        lipSyncRequired: Boolean(activeSpeaker),
        characters: cloneCharacters(scene.characters).map((character) => ({
          ...character,
          activeSpeaker: character.characterId === activeSpeaker,
          lipSyncRequired: character.characterId === activeSpeaker,
        })),
      },
    ];
  }

  const shots = turns.map((turn, index) => {
    const activeCharacter = scene.characters.find((character) => character.name.toLowerCase() === turn.speaker.toLowerCase());
    const activeSpeakerCharacterId = activeCharacter?.characterId;
    return {
      title: `${scene.title} — shot ${index + 1}`,
      dialogue: `${turn.speaker}: ${turn.line}`,
      narration: "",
      activeSpeakerCharacterId,
      lipSyncRequired: Boolean(activeSpeakerCharacterId),
      characters: cloneCharacters(scene.characters).map((character) => ({
        ...character,
        activeSpeaker: character.characterId === activeSpeakerCharacterId,
        lipSyncRequired: character.characterId === activeSpeakerCharacterId,
        presence: character.characterId === activeSpeakerCharacterId ? "main" : "background",
      })),
    } satisfies PlannedShot;
  });

  shots.push({
    title: `${scene.title} — shot ${shots.length + 1}`,
    dialogue: "",
    narration: scene.narration,
    activeSpeakerCharacterId: undefined,
    lipSyncRequired: false,
    characters: cloneCharacters(scene.characters).map((character) => ({
      ...character,
      activeSpeaker: false,
      lipSyncRequired: false,
    })),
  });

  return shots;
}
