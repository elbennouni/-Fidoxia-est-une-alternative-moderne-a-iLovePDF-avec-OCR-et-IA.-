export type CharacterRole = "main" | "secondary" | "extra";

export interface CharacterPhysicalTraits {
  gender: string;
  ageRange: string;
  hair: string;
  eyes: string;
  faceShape: string;
  skinTone: string;
  bodyType: string;
  distinctiveFeatures: string[];
}

export interface CharacterVisualDNA {
  summary: string;
  identityLockPrompt: string;
  resemblancePrompt: string;
  styleNotes?: string;
  lockedPrompt?: string;
  faceShape?: string;
  eyeColor?: string;
  eyeShape?: string;
  noseShape?: string;
  mouthShape?: string;
  skinTone?: string;
  hairColor?: string;
  hairStyle?: string;
  bodyType?: string;
  height?: string;
  topClothing?: string;
  bottomClothing?: string;
  shoes?: string;
  accessories?: string;
  colorPalette?: string;
  pixarFeatures?: string;
  facialExpression?: string;
  distinctiveFeature?: string;
}

export interface StrictCharacterRecord {
  id: string;
  name: string;
  role: CharacterRole;
  description: string;
  physicalDescription?: string;
  outfit?: string;
  personality?: string;
  voiceProfile?: string | null;
  heygenVoiceId?: string | null;
  faceReferenceImages: string[];
  fullBodyReferenceImages: string[];
  outfitReferenceImages: string[];
  voiceReferenceAudio?: string | null;
  identityLock: boolean;
  faceConsistencyStrength: number;
  outfitConsistencyStrength: number;
  physicalTraits: CharacterPhysicalTraits;
  visualDNA: CharacterVisualDNA;
  negativeIdentityPrompt: string;
  consistencyPrompt: string;
  defaultOutfit?: string;
  referenceImageUrl?: string | null;
  legacyReferenceImageUrl?: string | null;
  legacyConsistencyPrompt?: string | null;
  legacyOutfit?: string | null;
  legacyVoiceProfile?: string | null;
  legacyHeygenVoiceId?: string | null;
}

export type SceneCharacterPresence = "main" | "background";
export type SceneOutfitMode = "use_default" | "use_reference" | "custom";

export interface SceneCharacterUsage {
  characterId: string;
  name: string;
  presence: SceneCharacterPresence;
  activeSpeaker: boolean;
  lipSyncRequired: boolean;
  expression: string;
  action: string;
  positionInFrame: string;
  outfitMode: SceneOutfitMode;
  outfitReferenceId?: string;
  customOutfitDescription?: string;
}

export interface SceneEnvironmentConfig {
  id?: string;
  name: string;
  description: string;
  referenceImages: string[];
  lighting: string;
  mood: string;
}

export interface SceneCameraConfig {
  shotType: string;
  angle: string;
  lens: string;
  movement: string;
  depthOfField: string;
}

export interface StrictSceneDefinition {
  id: string;
  title: string;
  duration: number;
  format: "9:16" | "16:9" | "1:1";
  characters: SceneCharacterUsage[];
  environment: SceneEnvironmentConfig;
  camera: SceneCameraConfig;
  imagePrompt: string;
  videoPrompt: string;
  dialogue: string;
  narration: string;
  audioFile?: string | null;
  activeSpeakerCharacterId?: string | null;
  negativePrompt: string;
  consistencyRules: string[];
  lipSyncEnabled?: boolean;
  preflightWarnings?: string[];
  sourceSceneId?: string;
}

export interface SplitSceneShot {
  shotNumber: number;
  title: string;
  activeSpeakerCharacterId?: string;
  dialogue: string;
  narration: string;
  lipSyncRequired: boolean;
  reactionCharacters: string[];
  promptNote: string;
}

export interface GenerationReferenceImage {
  type: "face" | "full_body" | "outfit" | "environment" | "pose";
  characterId?: string;
  url: string;
  strength: number;
}

export interface GenerationAudioPayload {
  activeSpeakerCharacterId?: string;
  fileUrl?: string;
  lipsync: boolean;
}

export interface GenerationPayload {
  promptImage: string;
  promptVideo: string;
  negativePrompt: string;
  referenceImages: GenerationReferenceImage[];
  audio: GenerationAudioPayload;
}

export interface PreflightIssue {
  level: "warning" | "error";
  code: string;
  message: string;
}

export interface PreflightReport {
  ok: boolean;
  requiresAdminOverride: boolean;
  issues: PreflightIssue[];
  warnings?: string[];
  blockers?: string[];
  errors?: string[];
  summary?: string;
  canGenerate?: boolean;
}

export type CharacterConsistencySnapshot = StrictCharacterRecord;
export type StrictCharacterProfile = StrictCharacterRecord;
export type CharacterIdentityRecord = StrictCharacterRecord;
export type CharacterConsistencyProfile = StrictCharacterRecord;
export type StrictCharacter = StrictCharacterRecord;

export type SceneConsistencyData = StrictSceneDefinition;
export type SceneConsistencyModel = StrictSceneDefinition;
export type ConsistencyScene = StrictSceneDefinition;
export type StrictScene = StrictSceneDefinition;

export type SceneEnvironmentData = SceneEnvironmentConfig;
export type EnvironmentConsistencyProfile = SceneEnvironmentConfig;
export type StrictEnvironment = SceneEnvironmentConfig;

export type ScenePromptCharacter = SceneCharacterUsage;
export type SceneGenerationPayload = GenerationPayload;
export type PreflightCheckResult = {
  ok: boolean;
  warnings: string[];
  blockingErrors: string[];
  requiresAdminOverride: boolean;
};

