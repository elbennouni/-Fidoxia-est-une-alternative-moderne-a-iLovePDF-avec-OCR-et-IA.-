import { getCharacterDescriptionsBlock } from "./characterConsistencyAgent";
import type { CharacterData } from "./characterConsistencyAgent";

function extractDialogueSpeakers(dialogue: string): string[] {
  const speakers = dialogue
    .split("\n")
    .map((line) => line.match(/^\s*([^:\n]{1,40})\s*:/)?.[1]?.trim())
    .filter((speaker): speaker is string => Boolean(speaker));

  return [...new Set(speakers)];
}

export function buildSpeechDirectionBlock(params: {
  dialogue?: string;
  narration?: string;
}): string {
  const dialogue = params.dialogue?.trim() || "";
  const narration = params.narration?.trim() || "";
  const speakers = dialogue ? extractDialogueSpeakers(dialogue) : [];

  if (!dialogue && !narration) return "";

  if (dialogue) {
    const speakerList = speakers.length > 0 ? speakers.join(", ") : "the speaking character";
    return `Speech performance:
On-screen dialogue is present.
Dialogue lines:
${dialogue}
Visible speakers: ${speakerList}.
Use readable speech framing: medium close-up, over-the-shoulder, or two-shot during line delivery.
Animate precise lip sync for the active speaker only: visible mouth and jaw articulation on every spoken phrase, mouth closes on pauses, listeners keep lips mostly closed with subtle reactions.
Add natural conversational beats: blinks, eyebrow motion, head nods, reaction pauses between lines.
Do not keep all characters talking at once.
Do not hide the active speaker in a wide shot during key dialogue lines.`;
  }

  return `Voice-over direction:
Narration is present without visible on-screen dialogue.
Narration text:
${narration}
Characters should react through eyes, posture, and gestures.
Keep mouths mostly closed unless a character is visibly speaking on screen.`;
}

export async function generateImagePrompt(params: {
  scene: {
    sceneNumber: number;
    action: string;
    location: string;
    characters: string[];
    emotion: string;
    camera: string;
    narration: string;
    dialogue: string;
  };
  visualStyle: string;
  format: string;
  allCharacters: CharacterData[];
  environmentDescription?: string;
}): Promise<string> {
  const { scene, visualStyle, format, allCharacters, environmentDescription } = params;
  const characterDesc = getCharacterDescriptionsBlock(scene.characters, allCharacters);
  const dialogueSpeakers = scene.dialogue ? extractDialogueSpeakers(scene.dialogue) : [];
  const dialogueCue = scene.dialogue
    ? ` Dialogue beat: ${dialogueSpeakers.length > 0 ? dialogueSpeakers.join(", ") : scene.characters.join(", ")} speaking on screen with readable expressions.`
    : "";

  return `${visualStyle} cinematic keyframe, ${format}, Characters: ${characterDesc || scene.characters.join(", ")}, Location: ${scene.location}${environmentDescription ? ` - ${environmentDescription}` : ""}, Action: ${scene.action}, Emotion: ${scene.emotion}, Camera: ${scene.camera}.${dialogueCue} coherent with episode storyboard, same character identity, same outfit, high-quality animated still.`;
}

export async function generateVideoPrompt(params: {
  scene: {
    sceneNumber: number;
    action: string;
    location: string;
    characters: string[];
    emotion: string;
    camera: string;
    soundDesign: string;
    narration: string;
    dialogue: string;
  };
  visualStyle: string;
  format: string;
  allCharacters: CharacterData[];
  environmentDescription?: string;
  previousSceneContext?: string;
}): Promise<string> {
  const { scene, visualStyle, format, allCharacters, environmentDescription, previousSceneContext } = params;
  const characterDesc = getCharacterDescriptionsBlock(scene.characters, allCharacters);
  const speechDirection = buildSpeechDirectionBlock({
    dialogue: scene.dialogue,
    narration: scene.narration,
  });

  const [cameraStart, ...cameraRest] = scene.camera.split(",");
  const cameraMovement = cameraRest.join(",").trim() || scene.camera;

  return `${format} cinematic animated scene in ${visualStyle}.
This scene strictly follows the episode script: ${scene.action}.

Characters present:
${characterDesc || scene.characters.join(", ")}

Location:
${scene.location}${environmentDescription ? ` - ${environmentDescription}` : ""}

Main action:
${scene.action}

Character animation:
Full-body movement, gestures, reactions and interactions: characters move naturally through the scene, reacting to each other with expressive body language.

Facial expressions:
${scene.emotion}

Camera direction:
Start with ${cameraStart || "wide establishing shot"}.
Move with ${cameraMovement}.
End on close-up of key character reaction.

Environment animation:
Natural environment movement, crowd reactions, atmospheric effects matching the scene mood.

Sound design:
${scene.soundDesign}

${speechDirection ? `${speechDirection}\n` : ""}

${previousSceneContext ? `Continuity with previous scene: ${previousSceneContext}` : ""}

Continuity:
Same characters, same outfits, same lighting, same environment and same visual identity as previous scenes.

NEGATIVE INSTRUCTIONS:
Do not create a static image.
Do not freeze the characters.
Do not create a portrait only.
Do not ignore the script.
Do not change character identity.
Do not change outfit.
Do not change visual style.
Full cinematic animated movement required.`;
}

export async function generateAllPrompts(params: {
  scenes: Array<{
    sceneNumber: number;
    action: string;
    location: string;
    characters: string[];
    emotion: string;
    camera: string;
    soundDesign: string;
    narration: string;
    dialogue: string;
  }>;
  visualStyle: string;
  format: string;
  allCharacters: CharacterData[];
  environments: Array<{ name: string; description: string }>;
}): Promise<Array<{ imagePrompt: string; videoPrompt: string }>> {
  const { scenes, visualStyle, format, allCharacters, environments } = params;

  const results = await Promise.all(
    scenes.map(async (scene, idx) => {
      const env = environments.find(e =>
        scene.location.toLowerCase().includes(e.name.toLowerCase())
      );
      const previousScene = idx > 0 ? scenes[idx - 1] : null;

      const [imagePrompt, videoPrompt] = await Promise.all([
        generateImagePrompt({ scene, visualStyle, format, allCharacters, environmentDescription: env?.description }),
        generateVideoPrompt({
          scene,
          visualStyle,
          format,
          allCharacters,
          environmentDescription: env?.description,
          previousSceneContext: previousScene ? `Scene ${previousScene.sceneNumber}: ${previousScene.action}` : undefined,
        }),
      ]);

      return { imagePrompt, videoPrompt };
    })
  );

  return results;
}
