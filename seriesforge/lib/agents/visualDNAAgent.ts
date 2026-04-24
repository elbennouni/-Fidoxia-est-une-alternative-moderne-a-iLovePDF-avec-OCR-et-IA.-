import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface VisualDNA {
  // Physique précis
  faceShape: string;
  eyeColor: string;
  eyeShape: string;
  noseShape: string;
  mouthShape: string;
  skinTone: string;
  hairColor: string;
  hairStyle: string;
  bodyType: string;
  height: string;
  // Tenue précise
  topClothing: string;
  bottomClothing: string;
  shoes: string;
  accessories: string;
  colorPalette: string;
  // Style Pixar précis
  pixarFeatures: string;
  facialExpression: string;
  distinctiveFeature: string;
  // Prompt complet verrouillé
  lockedPrompt: string;
}

export async function generateVisualDNA(params: {
  character: {
    name: string;
    physicalDescription: string;
    outfit: string;
    personality: string;
    referenceImageUrl?: string | null;
  };
  visualStyle: string;
}): Promise<VisualDNA> {
  const { character, visualStyle } = params;

  const systemPrompt = `You are a Pixar character designer specializing in visual consistency. 
Your job is to create an extremely precise visual DNA for a character that will be used to generate 100% consistent images across all scenes.
Every detail must be so precise that any AI image generator produces the exact same character every time.`;

  const userPrompt = `Create the complete visual DNA for this character in ${visualStyle} style.

CHARACTER:
Name: ${character.name}
Physical description: ${character.physicalDescription}
Outfit: ${character.outfit}
Personality: ${character.personality}

Return ONLY valid JSON with these exact fields. Be EXTREMELY precise and specific — no vague terms:

{
  "faceShape": "exact face shape e.g. 'round with slightly pronounced cheekbones, strong jawline'",
  "eyeColor": "exact color e.g. 'deep brown with golden amber ring around pupil'",
  "eyeShape": "exact shape e.g. 'large almond-shaped, heavy upper lids, thick black lashes'",
  "noseShape": "exact shape e.g. 'medium width, slightly flat tip, rounded nostrils'",
  "mouthShape": "exact shape e.g. 'full lips, defined cupid bow, wide smile'",
  "skinTone": "exact tone e.g. 'warm medium brown, Mediterranean olive undertone'",
  "hairColor": "exact color e.g. 'jet black with subtle blue highlights'",
  "hairStyle": "exact style e.g. 'short textured fade, 2cm on top, tight on sides'",
  "bodyType": "exact type e.g. 'athletic mesomorph, broad shoulders, V-shape torso, muscular arms'",
  "height": "relative height e.g. 'tall, 6ft2, long legs'",
  "topClothing": "exact top e.g. 'torn khaki shorts waistband visible, no shirt, bare athletic chest'",
  "bottomClothing": "exact bottom e.g. 'torn khaki cargo shorts, knee-length, frayed edges, sand-stained'",
  "shoes": "exact footwear e.g. 'no shoes, bare feet, tan from sun'",
  "accessories": "exact accessories e.g. 'thick braided tribal cord necklace with wooden beads, brown leather wristband left wrist'",
  "colorPalette": "character color palette e.g. 'warm browns, khaki, tan skin, black hair — earthy survival palette'",
  "pixarFeatures": "specific Pixar 3D features e.g. 'large expressive eyes typical of Pixar, slightly exaggerated athletic proportions, smooth but detailed skin texture, subsurface scattering on skin'",
  "facialExpression": "default expression e.g. 'confident wide grin, raised left eyebrow, mischievous energy'",
  "distinctiveFeature": "most recognizable feature e.g. 'tribal necklace and athletic bare chest combination'",
  "lockedPrompt": "A single ultra-detailed prompt sentence (80-120 words) that locks all visual features and would produce identical results each time. Include Pixar 3D style, all physical features, outfit, colors."
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  return JSON.parse(response.choices[0].message.content || "{}") as VisualDNA;
}

export function buildScenePromptWithDNA(params: {
  characters: Array<{
    name: string;
    visualDNA?: VisualDNA | null;
    consistencyPrompt: string;
  }>;
  sceneCharacters: string[];
  location: string;
  environmentDescription: string;
  action: string;
  emotion: string;
  camera: string;
  visualStyle: string;
  format: string;
  lighting?: string;
  mood?: string;
}): string {
  const {
    characters, sceneCharacters, location, environmentDescription,
    action, emotion, camera, visualStyle, format, lighting, mood
  } = params;

  const presentChars = characters.filter(c =>
    sceneCharacters.some(sc => sc.toLowerCase().includes(c.name.toLowerCase()))
  );

  // Build ultra-precise character block
  const charBlock = presentChars.map(c => {
    if (c.visualDNA) {
      return `CHARACTER "${c.name}" (LOCKED VISUAL IDENTITY):
- Face: ${c.visualDNA.faceShape}, ${c.visualDNA.eyeShape} ${c.visualDNA.eyeColor} eyes, ${c.visualDNA.noseShape} nose, ${c.visualDNA.mouthShape}
- Skin: ${c.visualDNA.skinTone}
- Hair: ${c.visualDNA.hairColor}, ${c.visualDNA.hairStyle}
- Body: ${c.visualDNA.bodyType}
- Wearing: ${c.visualDNA.topClothing} + ${c.visualDNA.bottomClothing} + ${c.visualDNA.shoes}
- Accessories: ${c.visualDNA.accessories}
- Pixar style: ${c.visualDNA.pixarFeatures}
- Expression: ${c.visualDNA.facialExpression}
- Signature: ${c.visualDNA.distinctiveFeature}`;
    }
    return `CHARACTER "${c.name}": ${c.consistencyPrompt}`;
  }).join("\n\n");

  const prompt = `${visualStyle}, ${format} format, cinematic keyframe.

STYLE REQUIREMENTS: Pixar 3D animated movie quality. Smooth subsurface skin. Large expressive eyes. Cinematic lighting. Film grain. No photorealism. Pure Pixar 3D animation style identical to Finding Nemo, Coco, The Incredibles.

${charBlock}

SCENE LOCATION: ${location}
ENVIRONMENT: ${environmentDescription}${lighting ? `. Lighting: ${lighting}` : ""}${mood ? `. Mood: ${mood}` : ""}

ACTION: ${action}
EMOTION: ${emotion}
CAMERA: ${camera}

CRITICAL RULES:
- Render ONLY in ${visualStyle} style — no photorealism, no anime, no 2D
- Every character MUST match their locked visual identity EXACTLY
- Same face, same hair, same outfit, same accessories as described above
- Characters must be recognizable as the same person from any other scene
- High quality Pixar studio render quality`;

  return prompt;
}
