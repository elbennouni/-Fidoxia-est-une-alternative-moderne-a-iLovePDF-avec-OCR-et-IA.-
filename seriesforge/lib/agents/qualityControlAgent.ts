import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface QualityReport {
  sceneNumber: number;
  score: number;
  issues: string[];
  passed: boolean;
}

export async function checkSceneQuality(params: {
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
    characters?: string | null;
  };
  visualStyle: string;
  previousScene?: {
    sceneNumber: number;
    action?: string | null;
    location?: string | null;
  } | null;
}): Promise<QualityReport> {
  const { scene, visualStyle, previousScene } = params;

  const prompt = `You are a quality control agent for AI-generated animated series scenes.
LANGUAGE RULE: Write issues and feedback in the SAME LANGUAGE as the scene content.

Evaluate this scene on a scale of 0-100 based on these criteria:
1. Has clear visible action (not just description)
2. Has body movement for characters
3. Has camera movement direction
4. Has emotion/atmosphere
5. Has sound design
6. Has narration or dialogue
7. Video prompt is detailed and cinematic
8. Not static (would produce motion, not a still)
9. Respects visual style: ${visualStyle}
10. Has continuity with previous scene (if applicable)
11. Characters are named and present
12. Image prompt is vivid and specific

Scene to evaluate:
Action: ${scene.action || "MISSING"}
Narration: ${scene.narration || "MISSING"}
Dialogue: ${scene.dialogue || "MISSING"}
Camera: ${scene.camera || "MISSING"}
Emotion: ${scene.emotion || "MISSING"}
Sound Design: ${scene.soundDesign || "MISSING"}
Image Prompt length: ${scene.imagePrompt?.length || 0} chars
Video Prompt length: ${scene.videoPrompt?.length || 0} chars
Characters: ${scene.characters || "MISSING"}

${previousScene ? `Previous scene: ${previousScene.action}` : "First scene - no continuity check needed"}

Return JSON only:
{
  "score": 85,
  "issues": ["list of specific issues found"],
  "passed": true
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return {
    sceneNumber: scene.sceneNumber,
    score: result.score || 0,
    issues: result.issues || [],
    passed: result.passed ?? (result.score >= 85),
  };
}

export async function checkAllScenes(params: {
  scenes: Array<{
    sceneNumber: number;
    action?: string | null;
    narration?: string | null;
    dialogue?: string | null;
    camera?: string | null;
    emotion?: string | null;
    soundDesign?: string | null;
    imagePrompt?: string | null;
    videoPrompt?: string | null;
    characters?: string | null;
  }>;
  visualStyle: string;
}): Promise<QualityReport[]> {
  const reports: QualityReport[] = [];

  for (let i = 0; i < params.scenes.length; i++) {
    const scene = params.scenes[i];
    const previousScene = i > 0 ? params.scenes[i - 1] : null;

    const report = await checkSceneQuality({
      scene,
      visualStyle: params.visualStyle,
      previousScene,
    });
    reports.push(report);
  }

  return reports;
}
