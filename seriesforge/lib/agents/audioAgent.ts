import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface AudioPlan {
  theme: string;
  themePrompt: string;
  scenes: Array<{
    sceneNumber: number;
    narratorVoice: string;
    audioPrompt: string;
    voiceProvider: string;
    backgroundMusic: string;
    soundEffects: string[];
  }>;
}

export async function generateAudioPlan(params: {
  episodeTitle: string;
  seriesTitle: string;
  tone: string;
  visualStyle: string;
  scenes: Array<{
    sceneNumber: number;
    narration: string;
    dialogue: string;
    soundDesign: string;
    emotion: string;
  }>;
  characters: Array<{ name: string; voiceProfile?: string | null }>;
}): Promise<AudioPlan> {
  const { episodeTitle, seriesTitle, tone, visualStyle, scenes, characters } = params;

  const voiceProfiles = characters
    .map(c => `${c.name}: ${c.voiceProfile || "neutral voice"}`)
    .join(", ");

  const prompt = `You are a professional sound designer and audio director for animated series.

SERIES: "${seriesTitle}"
EPISODE: "${episodeTitle}"
TONE: ${tone}
VISUAL STYLE: ${visualStyle}
CHARACTER VOICES: ${voiceProfiles}

Create a complete audio plan for all ${scenes.length} scenes. Return valid JSON only.

{
  "theme": "Title of the theme song",
  "themePrompt": "Detailed music generation prompt for the series theme (20-30 words, genre, instruments, mood)",
  "scenes": [
    {
      "sceneNumber": 1,
      "narratorVoice": "Narrator text adapted for voice (or empty)",
      "audioPrompt": "Complete audio direction: music style, BPM, instruments, emotional arc",
      "voiceProvider": "elevenlabs",
      "backgroundMusic": "Music style and mood description",
      "soundEffects": ["sound1", "sound2"]
    }
  ]
}

Scenes data:
${JSON.stringify(scenes, null, 2)}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  return JSON.parse(response.choices[0].message.content || "{}") as AudioPlan;
}
