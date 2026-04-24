import type { VideoPromptBuildInput } from "@/lib/pipeline-types";
import { STYLE_DESCRIPTIONS, STYLE_LABELS, styleThemes, type VideoThemeKey } from "@/lib/video-themes";

type VideoFormatValue = "VERTICAL_9_16" | "HORIZONTAL_16_9";

function isVideoThemeKey(value: string): value is VideoThemeKey {
  return (styleThemes as readonly string[]).includes(value);
}

export function buildStorySystemPrompt() {
  return [
    "You are an expert showrunner for coherent animated episodic content.",
    "Return STRICT JSON only. No markdown.",
    "Generate scenes[] where each scene includes: action, charactersInShot, emotion, location.",
    "Each scene action must be visual and dynamic, not static.",
    "Maintain strict continuity for characters, outfits, style, and locations.",
    "Scene transitions should be coherent with previous scenes.",
  ].join(" ");
}

export function buildStoryUserPrompt(input: {
  seriesTitle: string;
  style: VideoThemeKey;
  tone: string;
  brief: string;
  sceneCount: number;
  characters: Array<{ name: string; physicalDescription: string; outfit: string; consistencyId: string }>;
  environments: Array<{ locationName: string; visualDescription: string; lighting: string; mood: string }>;
}) {
  const styleLabel = STYLE_LABELS[input.style];
  const characterBlock = input.characters
    .map(
      (c) =>
        `- ${c.name} [consistency:${c.consistencyId}] :: ${c.physicalDescription} :: outfit locked: ${c.outfit}`,
    )
    .join("\n");
  const environmentBlock = input.environments
    .map((e) => `- ${e.locationName} :: ${e.visualDescription} :: lighting ${e.lighting} :: mood ${e.mood}`)
    .join("\n");

  return [
    `Series: ${input.seriesTitle}`,
    `Style: ${styleLabel}`,
    `Tone: ${input.tone}`,
    `Scene count: ${input.sceneCount}`,
    `Story brief: ${input.brief}`,
    "Characters (strict):",
    characterBlock,
    "Environments:",
    environmentBlock,
    "Output JSON with shape:",
    '{"scriptOverview":"...", "scenes":[{"action":"...","charactersInShot":"...","emotion":"...","location":"..."}]}',
  ].join("\n");
}

export function buildStoryboardPrompt(input: {
  style: string;
  sceneAction: string;
  sceneEmotion: string;
  sceneLocation: string;
  characters: Array<{ name: string; physicalDescription: string; outfit: string; consistencyId: string }>;
}) {
  const styleLabel =
    STYLE_LABELS[input.style as VideoThemeKey] ?? input.style.replaceAll("_", " ");
  const characterText = input.characters
    .map(
      (c) =>
        `${c.name} [${c.consistencyId}] with exact appearance: ${c.physicalDescription}. Locked outfit: ${c.outfit}.`,
    )
    .join(" ");

  return [
    `Cinematic animated keyframe in ${styleLabel}.`,
    `Scene action: ${input.sceneAction}.`,
    `Emotion: ${input.sceneEmotion}.`,
    `Location: ${input.sceneLocation}.`,
    `Characters: ${characterText}`,
    "Camera angle: medium-wide dynamic framing with depth.",
    "Style consistency mandatory across all frames.",
    "No style drift, no character drift, no outfit change.",
  ].join(" ");
}

export function buildVideoPrompt(input: VideoPromptBuildInput) {
  return [
    `${input.formatLabel} cinematic animated scene in ${input.styleLabel}.`,
    `This scene strictly follows: ${input.scriptAction}.`,
    "",
    "Characters:",
    input.charactersDescription,
    "",
    "Location:",
    input.environmentDescription,
    "",
    "Action:",
    input.visibleAction,
    "",
    "Character animation:",
    "- full body movement",
    "- gestures",
    "- interaction",
    "",
    "Facial expressions:",
    input.emotions,
    "",
    "Camera:",
    `- start: ${input.cameraStart}`,
    `- movement: ${input.cameraMovement}`,
    `- end: ${input.cameraEnd}`,
    "",
    "Environment animation:",
    input.environmentAnimation,
    "",
    "Sound:",
    input.soundDesign,
    "",
    "Continuity:",
    input.continuityRule,
    "",
    "NEGATIVE:",
    "no static image",
    "no frozen pose",
    "no portrait only",
    "no style change",
    "no character inconsistency",
    "",
    "FULL cinematic motion required.",
  ].join("\n");
}

export function formatLabelFromVideoFormat(format: VideoFormatValue): "Vertical" | "Horizontal" {
  return format === "VERTICAL_9_16" ? "Vertical" : "Horizontal";
}

export function getStyleDescription(style: VideoThemeKey): string {
  return `${STYLE_LABELS[style]} (${STYLE_DESCRIPTIONS[style]})`;
}

export function normalizeStyleTheme(style: string): VideoThemeKey {
  return isVideoThemeKey(style) ? style : "PIXAR_3D";
}
