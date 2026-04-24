import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ScriptScene {
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

export interface GeneratedScript {
  title: string;
  synopsis: string;
  scenes: ScriptScene[];
}

export async function generateScript(params: {
  episodeTitle: string;
  episodeIdea: string;
  seriesTitle: string;
  visualStyle: string;
  tone: string;
  format: string;
  characters: Array<{ name: string; personality: string }>;
  environments: Array<{ name: string; description: string }>;
  sceneCount?: number;
}): Promise<GeneratedScript> {
  const { episodeTitle, episodeIdea, seriesTitle, visualStyle, tone, format, characters, environments, sceneCount = 8 } = params;

  const characterList = characters.map(c => `- ${c.name}: ${c.personality}`).join("\n");
  const envList = environments.map(e => `- ${e.name}: ${e.description}`).join("\n");

  const prompt = `You are a professional TV scriptwriter. Write a structured episode script for an animated series.

SERIES: "${seriesTitle}"
VISUAL STYLE: ${visualStyle}
TONE: ${tone}
FORMAT: ${format}
EPISODE TITLE: "${episodeTitle}"
EPISODE IDEA: ${episodeIdea}

AVAILABLE CHARACTERS:
${characterList}

AVAILABLE LOCATIONS:
${envList}

Generate exactly ${sceneCount} scenes. Return valid JSON only, no markdown, no extra text.

JSON structure:
{
  "title": "Episode title",
  "synopsis": "2-3 sentence synopsis",
  "scenes": [
    {
      "sceneNumber": 1,
      "timecode": "00:00-00:30",
      "location": "Location name",
      "characters": ["Character1", "Character2"],
      "action": "Detailed description of what happens visually",
      "narration": "Narrator voiceover text (or empty string)",
      "dialogue": "CHARACTER1: dialogue line. CHARACTER2: response.",
      "camera": "Camera direction and movement description",
      "emotion": "Primary emotion and atmosphere",
      "soundDesign": "Ambient sounds, music style, sound effects"
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const content = response.choices[0].message.content || "{}";
  return JSON.parse(content) as GeneratedScript;
}
