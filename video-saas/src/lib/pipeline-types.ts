export const PIPELINE_STEPS = [
  "SERIES_SETUP",
  "CHARACTERS",
  "ENVIRONMENTS",
  "STORY",
  "STORYBOARD",
  "AUDIO",
  "VIDEO",
  "COMPLETE",
] as const;

export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export type ScriptSceneInput = {
  sceneOrder: number;
  action: string;
  charactersInShot: string;
  emotion: string;
  location: string;
};

export type SceneQualityCheck = {
  scriptRespected: boolean;
  charactersConsistent: boolean;
  styleConsistent: boolean;
  realActionPresent: boolean;
  bodyMovementPresent: boolean;
  cameraMovementPresent: boolean;
  emotionPresent: boolean;
  audioPresent: boolean;
  staticShotDetected: boolean;
  reasons: string[];
};

export type VideoPromptBuildInput = {
  formatLabel: "Vertical" | "Horizontal";
  styleLabel: string;
  scriptAction: string;
  charactersDescription: string;
  environmentDescription: string;
  visibleAction: string;
  emotions: string;
  cameraStart: string;
  cameraMovement: string;
  cameraEnd: string;
  environmentAnimation: string;
  soundDesign: string;
  continuityRule: string;
};
