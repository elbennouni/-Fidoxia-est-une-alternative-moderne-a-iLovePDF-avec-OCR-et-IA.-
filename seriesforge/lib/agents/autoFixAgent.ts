import OpenAI from "openai";
import type { QualityReport } from "./qualityControlAgent";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface FixedScene {
  action: string;
  narration: string;
  dialogue: string;
  camera: string;
  emotion: string;
  soundDesign: string;
  imagePrompt: string;
  videoPrompt: string;
}

export async function autoFixScene(params: {
  scene: {
    sceneNumber: number;
    action?: string | null;
    narration?: string | null;
    dialogue?: string | null;
    camera?: string | null;
    emotion?: string | null;
    soundDesign?: string | null;
    imagePrompt?: string | null;
    videoPrompt?: string | null;
    location?: string | null;
    characters?: string | null;
  };
  issues: string[];
  visualStyle: string;
  format: string;
}): Promise<FixedScene> {
  const { scene, issues, visualStyle, format } = params;

  const prompt = `You are an expert animated series scene fixer. Fix this scene to score above 85/100.

ISSUES TO FIX:
${issues.join("\n")}

CURRENT SCENE (Scene ${scene.sceneNumber}):
Location: ${scene.location || "Unknown"}
Characters: ${scene.characters || "Unknown"}
Action: ${scene.action || "MISSING"}
Narration: ${scene.narration || "MISSING"}
Dialogue: ${scene.dialogue || "MISSING"}
Camera: ${scene.camera || "MISSING"}
Emotion: ${scene.emotion || "MISSING"}
Sound Design: ${scene.soundDesign || "MISSING"}
Image Prompt: ${scene.imagePrompt || "MISSING"}
Video Prompt: ${scene.videoPrompt || "MISSING"}

REQUIREMENTS:
- Visual style: ${visualStyle}
- Format: ${format}
- All fields must be detailed and specific
- Action must show visible body movement
- Camera must have start + movement + end frame
- Video prompt must be at least 200 characters
- Must not be static

Return improved JSON only:
{
  "action": "improved action description",
  "narration": "improved narration",
  "dialogue": "improved dialogue",
  "camera": "improved camera direction",
  "emotion": "improved emotion description",
  "soundDesign": "improved sound design",
  "imagePrompt": "improved 150+ char image prompt",
  "videoPrompt": "improved 250+ char video prompt"
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  return JSON.parse(response.choices[0].message.content || "{}") as FixedScene;
}
