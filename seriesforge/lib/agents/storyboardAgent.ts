import OpenAI from "openai";
import { getCharacterDescriptionsBlock } from "./characterConsistencyAgent";
import type { CharacterData } from "./characterConsistencyAgent";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateImagePrompt(params: {
  scene: {
    sceneNumber: number;
    action: string;
    location: string;
    characters: string[];
    emotion: string;
    camera: string;
  };
  visualStyle: string;
  format: string;
  allCharacters: CharacterData[];
  environmentDescription?: string;
}): Promise<string> {
  const { scene, visualStyle, format, allCharacters, environmentDescription } = params;
  const characterDesc = getCharacterDescriptionsBlock(scene.characters, allCharacters);

  return `${visualStyle} cinematic keyframe, ${format}, Characters: ${characterDesc || scene.characters.join(", ")}, Location: ${scene.location}${environmentDescription ? ` - ${environmentDescription}` : ""}, Action: ${scene.action}, Emotion: ${scene.emotion}, Camera: ${scene.camera}, coherent with episode storyboard, same character identity, same outfit, high-quality animated still.`;
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
