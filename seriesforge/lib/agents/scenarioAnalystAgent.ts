import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ParsedScene {
  sceneNumber: number;
  timecode: string;
  location: string;
  characters: string[];
  action: string;
  narration: string;
  dialogue: string;
  camera: string;
  emotion: string;
  soundDesign: string;
}

export interface ParsedScenario {
  title: string;
  synopsis: string;
  scenes: ParsedScene[];
}

export interface ArtisticDirection {
  colorPalette: string;
  lightingStyle: string;
  cameraStyle: string;
  characterDesignStyle: string;
  backgroundStyle: string;
  overallMood: string;
  visualReferences: string;
  negativeElements: string;
}

export async function analyzeAndNormalizeScenario(params: {
  rawJson: unknown;
  seriesVisualStyle: string;
  seriesTone: string;
  seriesTitle: string;
}): Promise<ParsedScenario> {
  const { rawJson, seriesVisualStyle, seriesTone, seriesTitle } = params;

  const prompt = `You are a professional script supervisor for an animated series.

The user has provided a scenario/script in JSON format. It might have any structure — different field names, nested objects, text blocks, etc.

CRITICAL LANGUAGE RULE: You MUST preserve and use the EXACT SAME LANGUAGE as the input scenario. If the input is in French, ALL your output text (action, narration, dialogue, emotion, soundDesign, synopsis, title) MUST be in French. Never translate.

Your job is to:
1. Read and understand ALL the content regardless of format
2. Extract every scene, dialogue, action, character, location
3. Normalize it into a strict structured format
4. Fill in missing fields intelligently based on context — IN THE SAME LANGUAGE as the input
5. Keep ALL original dialogue and narration text EXACTLY as written (same language)

SERIES CONTEXT:
- Title: ${seriesTitle}
- Visual Style: ${seriesVisualStyle}
- Tone: ${seriesTone}

RAW INPUT:
${JSON.stringify(rawJson, null, 2).slice(0, 8000)}

Return ONLY valid JSON, no markdown, no explanation:
{
  "title": "Episode title extracted from the scenario",
  "synopsis": "2-3 sentence synopsis of the episode",
  "scenes": [
    {
      "sceneNumber": 1,
      "timecode": "00:00-00:30",
      "location": "Location name",
      "characters": ["Character1", "Character2"],
      "action": "Detailed visual action description - what we SEE happening",
      "narration": "Narrator voiceover text (keep EXACTLY as written, or empty string)",
      "dialogue": "CHARACTER: line\\nCHARACTER2: response (keep EXACTLY as written, or empty string)",
      "camera": "Camera angle and movement",
      "emotion": "Primary emotion and atmosphere of the scene",
      "soundDesign": "Music, ambient sounds, sound effects"
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  return JSON.parse(response.choices[0].message.content || "{}") as ParsedScenario;
}

export async function generateArtisticDirection(params: {
  scenario: ParsedScenario;
  visualStyle: string;
  tone: string;
  seriesTitle: string;
  userDirective?: string;
}): Promise<ArtisticDirection> {
  const { scenario, visualStyle, tone, seriesTitle, userDirective } = params;

  const scenesSummary = scenario.scenes
    .slice(0, 5)
    .map(s => `Scene ${s.sceneNumber}: ${s.location} — ${s.emotion} — ${s.action.slice(0, 100)}`)
    .join("\n");

  const prompt = `You are a visionary art director for an animated series.

LANGUAGE RULE: Write all descriptions in the SAME LANGUAGE as the series title and scenario. If French → write in French.

Based on this episode scenario, define a complete artistic direction that will make every image visually consistent.

SERIES: ${seriesTitle}
VISUAL STYLE: ${visualStyle}
TONE: ${tone}
${userDirective ? `USER DIRECTIVE: ${userDirective}` : ""}

EPISODE: ${scenario.title}
SYNOPSIS: ${scenario.synopsis}

KEY SCENES:
${scenesSummary}

Define the artistic direction. Return ONLY JSON:
{
  "colorPalette": "Primary and secondary colors, saturation level, color temperature (e.g. 'warm golden tones, deep ocean blues, high saturation, tropical palette')",
  "lightingStyle": "How light works in this episode (e.g. 'harsh midday sun casting sharp shadows, golden hour warmth, dramatic rim lighting')",
  "cameraStyle": "Predominant camera angles and movements (e.g. 'dynamic low angles for action, wide establishing shots, tight close-ups for drama')",
  "characterDesignStyle": "How characters should look rendered (e.g. 'Pixar-style 3D, expressive faces, athletic proportions, beach-worn clothing')",
  "backgroundStyle": "Environment and background rendering style (e.g. 'lush tropical paradise, hyper-detailed foliage, cinematic depth of field')",
  "overallMood": "The visual mood that must be consistent (e.g. 'energetic summer competition reality TV feel, colorful, loud, fun')",
  "visualReferences": "Famous films/series this should visually reference (e.g. 'The Bear, Survivor reality TV, Pixar Finding Nemo color palette')",
  "negativeElements": "What to absolutely AVOID visually (e.g. 'no dark gothic tones, no desaturation, no horror elements, no static shots')"
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  return JSON.parse(response.choices[0].message.content || "{}") as ArtisticDirection;
}

export async function generateImagePromptsWithDA(params: {
  scene: ParsedScene;
  artisticDirection: ArtisticDirection;
  visualStyle: string;
  format: string;
  characters: Array<{ name: string; physicalDescription: string; outfit: string; consistencyPrompt: string }>;
  environments: Array<{ name: string; description: string }>;
  previousSceneContext?: string;
}): Promise<{ imagePrompt: string; videoPrompt: string }> {
  const { scene, artisticDirection: da, visualStyle, format, characters, environments, previousSceneContext } = params;

  const presentChars = characters.filter(c =>
    scene.characters.some(sc => sc.toLowerCase().includes(c.name.toLowerCase()))
  );

  const envMatch = environments.find(e =>
    scene.location.toLowerCase().includes(e.name.toLowerCase())
  );

  const charBlock = presentChars.length > 0
    ? presentChars.map(c => `${c.name}: ${c.physicalDescription}, ${c.outfit}`).join("\n")
    : scene.characters.join(", ");

  const imagePrompt = `${visualStyle} cinematic keyframe, ${format} format.
ARTISTIC DIRECTION: ${da.colorPalette}. ${da.lightingStyle}. ${da.overallMood}.
Location: ${scene.location}${envMatch ? ` — ${envMatch.description}` : ""}.
Characters: ${charBlock}.
Action: ${scene.action}.
Emotion: ${scene.emotion}.
Camera: ${scene.camera || da.cameraStyle}.
Background style: ${da.backgroundStyle}.
Color palette: ${da.colorPalette}.
High quality ${visualStyle}, consistent character identity, same outfit as series bible.
Visual references: ${da.visualReferences}.
AVOID: ${da.negativeElements}.`;

  const videoPrompt = `${format} cinematic animated scene — ${visualStyle}.

ARTISTIC DIRECTION:
Colors: ${da.colorPalette}
Lighting: ${da.lightingStyle}
Mood: ${da.overallMood}
Camera style: ${da.cameraStyle}

Scene: ${scene.action}

Characters present:
${charBlock}

Location: ${scene.location}${envMatch ? ` — ${envMatch.description}` : ""}

Main action: ${scene.action}

Character animation:
Full-body movement, expressive gestures, natural reactions. Dialogue delivered with matching mouth movement and body language.

Facial expressions: ${scene.emotion}

Camera: ${scene.camera || da.cameraStyle}

Sound: ${scene.soundDesign}

${previousSceneContext ? `Continuity: follows scene where ${previousSceneContext}` : ""}

Background animation: ${da.backgroundStyle} with natural movement.

CONSISTENCY: Same characters, same outfits, same color palette (${da.colorPalette}), same visual style as all other scenes.

VISUAL REFERENCES: ${da.visualReferences}

NEGATIVE: ${da.negativeElements}. Do not create static image. Full cinematic movement required.`;

  return { imagePrompt, videoPrompt };
}
